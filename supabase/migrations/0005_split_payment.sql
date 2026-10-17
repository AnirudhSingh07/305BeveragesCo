-- ===========================================================================
-- Split payments: an order can be settled partly in cash and partly online
-- (UPI). The order is labelled 'split'; the individual amounts are stored as
-- separate rows in `payments` (each keeping a real method: 'cash' / 'upi'),
-- so the cash-vs-online breakdown in reports stays accurate.
--
-- Re-runnable: drops/re-adds the check constraint and replaces create_order
-- (same signature as 0002, so it replaces in place).
-- ===========================================================================

-- Allow 'split' as an order-level payment label. Individual payment rows keep
-- their real methods, so payments.method is left unchanged.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('cash','upi','card','other','split'));

-- --------------------------------------------------------------------------
-- create_order (replaces the 0002 version). Adds split-payment handling.
-- When p_payment_method = 'split', p_amount_paid carries the CASH portion;
-- the order is recorded as fully paid and the remainder is booked as UPI.
-- --------------------------------------------------------------------------
create or replace function create_order(
  p_items          jsonb,                       -- [{"product_id":uuid,"quantity":int}, ...]
  p_discount_type  text    default 'none',
  p_discount_value numeric default 0,
  p_payment_method text    default 'cash',
  p_amount_paid    bigint  default 0,
  p_customer_name  text    default null,
  p_customer_phone text    default null,
  p_notes          text    default null,
  p_client_token   text    default null
) returns orders
language plpgsql security definer set search_path = public as $$
declare
  b           uuid := app_current_business_id();
  v_existing  orders;
  v_order     orders;
  v_order_id  uuid := gen_random_uuid();
  -- Business day starts at 05:00 IST (see DAY_START_HOUR in lib/datetime.ts):
  -- orders between midnight and 05:00 IST belong to the previous trading day.
  v_biz_date  date := ((now() at time zone 'Asia/Kolkata') - interval '5 hours')::date;
  v_seq       int;
  v_number    text;
  v_item      record;
  v_product   products;
  v_gross     bigint := 0;
  v_line      bigint;
  v_discount  bigint := 0;
  v_net       bigint;
  v_paid      bigint;
  v_cash      bigint := 0;   -- cash portion of a split payment
  v_online    bigint := 0;   -- online (UPI) portion of a split payment
  v_pstatus   text;
begin
  if b is null then raise exception 'No business for current user'; end if;

  -- Idempotency: return the already-saved order for a repeated submission.
  if p_client_token is not null then
    select * into v_existing from orders
      where business_id = b and client_token = p_client_token;
    if found then return v_existing; end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- Per-day, per-business sequential order number (race-safe upsert).
  insert into order_counters (business_id, biz_date, seq)
    values (b, v_biz_date, 1)
    on conflict (business_id, biz_date)
    do update set seq = order_counters.seq + 1
    returning seq into v_seq;
  v_number := 'ORD-' || to_char(v_biz_date, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  -- Insert the order shell first so items can reference it.
  insert into orders (
    id, business_id, order_number, status, payment_method,
    discount_type, discount_value, customer_name, customer_phone, notes,
    client_token, created_by
  ) values (
    v_order_id, b, v_number, 'completed', p_payment_method,
    coalesce(p_discount_type,'none'), coalesce(p_discount_value,0),
    p_customer_name, p_customer_phone, p_notes, p_client_token, auth.uid()
  );

  -- Snapshot each line.
  for v_item in
    select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity int)
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then continue; end if;
    select * into v_product from products
      where id = v_item.product_id and business_id = b;
    if not found then
      raise exception 'Product % not found in this business', v_item.product_id;
    end if;
    v_line := v_product.price_paise * v_item.quantity;
    insert into order_items (
      order_id, business_id, product_id, product_name, category_name,
      quantity, unit_price, unit_cost, line_total
    ) values (
      v_order_id, b, v_product.id, v_product.name,
      (select name from categories where id = v_product.category_id),
      v_item.quantity, v_product.price_paise, v_product.cost_paise, v_line
    );
    v_gross := v_gross + v_line;
  end loop;

  if v_gross = 0 then
    raise exception 'Order has no valid items';
  end if;

  -- Server-authoritative discount.
  if p_discount_type = 'percent' then
    v_discount := round(v_gross * least(greatest(coalesce(p_discount_value,0),0),100) / 100);
  elsif p_discount_type = 'flat' then
    v_discount := round(coalesce(p_discount_value,0));
  end if;
  v_discount := least(greatest(v_discount,0), v_gross);
  v_net := v_gross - v_discount;

  if p_payment_method = 'split' then
    -- p_amount_paid carries the cash portion; a split order is paid in full,
    -- with the remainder booked as online (UPI).
    v_cash   := least(greatest(coalesce(p_amount_paid,0),0), v_net);
    v_online := v_net - v_cash;
    v_paid   := v_net;
  else
    v_paid := least(greatest(coalesce(p_amount_paid,0),0), v_net);
  end if;

  if v_net = 0 or v_paid >= v_net then v_pstatus := 'paid';
  elsif v_paid = 0 then v_pstatus := 'unpaid';
  else v_pstatus := 'partial';
  end if;

  update orders set
    gross_amount = v_gross,
    discount_amount = v_discount,
    net_amount = v_net,
    amount_paid = v_paid,
    payment_status = v_pstatus
  where id = v_order_id
  returning * into v_order;

  if p_payment_method = 'split' then
    if v_cash > 0 then
      insert into payments (order_id, business_id, method, amount, created_by)
        values (v_order_id, b, 'cash', v_cash, auth.uid());
    end if;
    if v_online > 0 then
      insert into payments (order_id, business_id, method, amount, created_by)
        values (v_order_id, b, 'upi', v_online, auth.uid());
    end if;
  elsif v_paid > 0 then
    insert into payments (order_id, business_id, method, amount, created_by)
      values (v_order_id, b, p_payment_method, v_paid, auth.uid());
  end if;

  insert into audit_logs (business_id, actor, action, entity_type, entity_id, details)
    values (b, auth.uid(), 'order.create', 'order', v_order_id,
            jsonb_build_object('order_number', v_number, 'net_amount', v_net));

  return v_order;
end; $$;
