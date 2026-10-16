-- ===========================================================================
-- Daily closing: record an end-of-day snapshot for a business date. Idempotent
-- per (business_id, business_date) — regenerating overwrites and re-stamps.
-- ===========================================================================
create or replace function record_daily_closing(
  p_date date, p_snapshot jsonb
) returns daily_closings
language plpgsql security definer set search_path = public as $$
declare b uuid := app_current_business_id(); v_row daily_closings;
begin
  if b is null then raise exception 'No business for current user'; end if;

  insert into daily_closings (business_id, business_date, snapshot, generated_by)
    values (b, p_date, p_snapshot, auth.uid())
    on conflict (business_id, business_date)
    do update set snapshot = excluded.snapshot,
                  generated_by = excluded.generated_by,
                  generated_at = now()
    returning * into v_row;

  insert into audit_logs (business_id, actor, action, entity_type, entity_id, details)
    values (b, auth.uid(), 'daily_closing.generate', 'daily_closing', v_row.id,
            jsonb_build_object('business_date', p_date));
  return v_row;
end; $$;
