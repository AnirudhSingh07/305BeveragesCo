import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderRecord } from "./types";
import type { UtcRange } from "./datetime";

/** Shape returned by the orders+items join, for display + finance mapping. */
export interface OrderRow extends OrderRecord {
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  cancel_reason: string | null;
  discount_type: string;
  itemsDetailed: {
    id: string;
    product_name: string;
    category_name: string | null;
    quantity: number;
    unit_price: number;
    unit_cost: number | null;
    line_total: number;
  }[];
}

export interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  category_name: string | null;
  payment_method: string;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurrence: string | null;
  incurred_at: string;
  created_at: string;
  updated_at: string;
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

function toOrderRow(o: any): OrderRow {
  const itemsDetailed = (o.order_items ?? []).map((it: any) => ({
    id: it.id,
    product_name: it.product_name,
    category_name: it.category_name,
    quantity: it.quantity,
    unit_price: n(it.unit_price),
    unit_cost: it.unit_cost == null ? null : n(it.unit_cost),
    line_total: n(it.line_total),
  }));
  return {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    payment_status: o.payment_status,
    payment_method: o.payment_method,
    gross_amount: n(o.gross_amount),
    discount_amount: n(o.discount_amount),
    net_amount: n(o.net_amount),
    amount_paid: n(o.amount_paid),
    refunded_amount: n(o.refunded_amount),
    created_at: o.created_at,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    notes: o.notes,
    cancel_reason: o.cancel_reason,
    discount_type: o.discount_type,
    items: itemsDetailed.map((it: any) => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      unit_cost: it.unit_cost,
    })),
    itemsDetailed,
  };
}

/** All orders (with item snapshots) created within a UTC range, newest first. */
export async function getOrdersInRange(
  supabase: SupabaseClient,
  range: UtcRange
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .gte("created_at", range.startUtc)
    .lt("created_at", range.endUtc)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toOrderRow);
}

/** A single order with full detail (items, payments, refunds). */
export async function getOrderById(
  supabase: SupabaseClient,
  id: string
): Promise<
  (OrderRow & { payments: any[]; refunds: any[] }) | null
> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), payments(*), refunds(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...toOrderRow(data),
    payments: (data as any).payments ?? [],
    refunds: (data as any).refunds ?? [],
  };
}

/** Expenses (excluding soft-deleted) within a UTC range, newest first. */
export async function getExpensesInRange(
  supabase: SupabaseClient,
  range: UtcRange
): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .is("deleted_at", null)
    .gte("incurred_at", range.startUtc)
    .lt("incurred_at", range.endUtc)
    .order("incurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({ ...e, amount: n(e.amount) }));
}

/** Total operating expenses (paise) within a range. */
export async function getExpenseTotal(
  supabase: SupabaseClient,
  range: UtcRange
): Promise<number> {
  const rows = await getExpensesInRange(supabase, range);
  return rows.reduce((a, r) => a + r.amount, 0);
}
