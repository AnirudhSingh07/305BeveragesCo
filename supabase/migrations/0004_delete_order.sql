-- ===========================================================================
-- delete_order: permanently removes an order that was entered by mistake,
-- together with its items, payments and refunds (removed automatically via the
-- ON DELETE CASCADE foreign keys). A single audit_logs row is kept so the
-- deletion itself is recorded (order number, amounts, who, when, reason) even
-- though the order row is gone.
--
-- This is distinct from cancel_order: cancel VOIDS an order but keeps it for
-- history (excluded from revenue); delete is a true, irreversible removal for
-- correcting mistaken entries. RLS + an ownership re-check keep it tenant-scoped.
-- ===========================================================================
create or replace function delete_order(
  p_order_id uuid, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare b uuid := app_current_business_id(); v_order orders;
begin
  if b is null then raise exception 'No business for current user'; end if;

  select * into v_order from orders where id = p_order_id and business_id = b;
  if not found then raise exception 'Order not found'; end if;

  -- Cascades to order_items, payments and refunds via their FKs.
  delete from orders where id = p_order_id and business_id = b;

  insert into audit_logs (business_id, actor, action, entity_type, entity_id, details)
    values (b, auth.uid(), 'order.delete', 'order', p_order_id,
            jsonb_build_object(
              'order_number', v_order.order_number,
              'net_amount', v_order.net_amount,
              'amount_paid', v_order.amount_paid,
              'refunded_amount', v_order.refunded_amount,
              'reason', p_reason));
end; $$;
