-- ===========================================================================
-- Transactional order operations. Each function runs in a single implicit
-- transaction, snapshots prices/costs, computes money server-side in integer
-- paise, and writes an audit log. The browser never computes authoritative
-- totals. RLS + an ownership re-check in each function prevent cross-business
-- access.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- create_order: validates items, snapshots price/cost, computes totals,
-- assigns a human-readable order number, records an optional payment — all
-- atomically. Idempotent on (business_id, client_token).
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
  v_biz_date  date := (now() at time zone 'Asia/Kolkata')::date;
  v_seq       int;
  v_number    text;
  v_item      record;
  v_product   products;
  v_gross     bigint := 0;
  v_line      bigint;
  v_discount  bigint := 0;
  v_net       bigint;
  v_paid      bigint;
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

  v_paid := least(greatest(coalesce(p_amount_paid,0),0), v_net);
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

  if v_paid > 0 then
    insert into payments (order_id, business_id, method, amount, created_by)
      values (v_order_id, b, p_payment_method, v_paid, auth.uid());
  end if;

  insert into audit_logs (business_id, actor, action, entity_type, entity_id, details)
    values (b, auth.uid(), 'order.create', 'order', v_order_id,
            jsonb_build_object('order_number', v_number, 'net_amount', v_net));

  return v_order;
end; $$;

-- --------------------------------------------------------------------------
-- record_payment: adds a payment, recomputes payment_status.
-- --------------------------------------------------------------------------
create or replace function record_payment(
  p_order_id uuid, p_method text, p_amount bigint, p_note text default null
) returns orders
language plpgsql security definer set search_path = public as $$
declare b uuid := app_current_business_id(); v_order orders; v_owed bigint; v_paid bigint; v_status text;
begin
  select * into v_order from orders where id = p_order_id and business_id = b;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = 'cancelled' then raise exception 'Cannot pay a cancelled order'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  insert into payments (order_id, business_id, method, amount, note, created_by)
    values (p_order_id, b, p_method, p_amount, p_note, auth.uid());

  v_paid := v_order.amount_paid + p_amount;
  v_owed := greatest(v_order.net_amount - v_order.refunded_amount, 0);
  if v_paid >= v_owed then v_status := 'paid';
  elsif v_paid <= 0 then v_status := 'unpaid';
  else v_status := 'partial';
  end if;

  update orders set amount_paid = v_paid, payment_status = v_status
    where id = p_order_id returning * into v_order;

  insert into audit_logs (business_id, actor, action, entity_type, entity_id, details)
    values (b, auth.uid(), 'order.payment', 'order', p_order_id,
            jsonb_build_object('amount', p_amount, 'method', p_method));
  return v_order;
end; $$;

-- --------------------------------------------------------------------------
-- refund_order: records a refund against a valid order with an audit trail.
-- --------------------------------------------------------------------------
create or replace function refund_order(
  p_order_id uuid, p_amount bigint, p_reason text default null
) returns orders
language plpgsql security definer set search_path = public as $$
declare b uuid := app_current_business_id(); v_order orders; v_refunded bigint; v_status text; v_owed bigint;
begin
  select * into v_order from orders where id = p_order_id and business_id = b;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status = 'cancelled' then raise exception 'Cannot refund a cancelled order'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Refund amount must be positive'; end if;
  if v_order.refunded_amount + p_amount > v_order.net_amount then
    raise exception 'Refund exceeds order net amount';
  end if;

  insert into refunds (order_id, business_id, amount, reason, created_by)
    values (p_order_id, b, p_amount, p_reason, auth.uid());

  v_refunded := v_order.refunded_amount + p_amount;
  v_owed := greatest(v_order.net_amount - v_refunded, 0);
  if v_order.amount_paid >= v_owed then v_status := 'paid';
  elsif v_order.amount_paid <= 0 then v_status := 'unpaid';
  else v_status := 'partial';
  end if;

  update orders set refunded_amount = v_refunded, payment_status = v_status
    where id = p_order_id returning * into v_order;

  insert into audit_logs (business_id, actor, action, entity_type, entity_id, details)
    values (b, auth.uid(), 'order.refund', 'order', p_order_id,
            jsonb_build_object('amount', p_amount, 'reason', p_reason));
  return v_order;
end; $$;

-- --------------------------------------------------------------------------
-- cancel_order: voids an order (kept for history, excluded from revenue).
-- --------------------------------------------------------------------------
create or replace function cancel_order(
  p_order_id uuid, p_reason text
) returns orders
language plpgsql security definer set search_path = public as $$
declare b uuid := app_current_business_id(); v_order orders;
begin
  select * into v_order from orders where id = p_order_id and business_id = b;
  if not found then raise exception 'Order not found'; end if;

  update orders set status = 'cancelled', cancel_reason = p_reason
    where id = p_order_id returning * into v_order;

  insert into audit_logs (business_id, actor, action, entity_type, entity_id, details)
    values (b, auth.uid(), 'order.cancel', 'order', p_order_id,
            jsonb_build_object('reason', p_reason));
  return v_order;
end; $$;
