/**
 * Pure aggregation helpers that turn order/expense records into chart-ready
 * datasets. All day bucketing uses the Asia/Kolkata business date.
 */
import { businessDate, addIstDays, type UtcRange } from "./datetime";
import { isRevenueOrder } from "./finance";
import type { OrderRecord } from "./types";

export interface ExpenseLike {
  amount: number;
  incurred_at: string;
  category_name: string | null;
}

/** Inclusive sequence of IST business-date strings spanning a UTC range. */
export function daySequence(range: UtcRange): string[] {
  const start = businessDate(new Date(range.startUtc));
  // endUtc is exclusive; subtract 1ms to get the last included instant.
  const end = businessDate(new Date(new Date(range.endUtc).getTime() - 1));
  const out: string[] = [];
  let cur = start;
  // Guard against pathological ranges.
  for (let i = 0; i < 400 && cur <= end; i++) {
    out.push(cur);
    cur = addIstDays(cur, 1);
  }
  return out;
}

export interface DailyPoint {
  date: string;
  netSales: number;
  grossProfit: number;
  orders: number;
  cogs: number;
  expenses: number;
  profit: number; // grossProfit - expenses
}

export function dailySeries(
  orders: OrderRecord[],
  expenses: ExpenseLike[],
  range: UtcRange
): DailyPoint[] {
  const days = daySequence(range);
  const map = new Map<string, DailyPoint>();
  for (const d of days) {
    map.set(d, { date: d, netSales: 0, grossProfit: 0, orders: 0, cogs: 0, expenses: 0, profit: 0 });
  }

  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;
    const d = businessDate(new Date(o.created_at));
    const p = map.get(d);
    if (!p) continue;
    const net = o.net_amount - o.refunded_amount;
    let cogs = 0;
    for (const it of o.items) {
      if (it.unit_cost != null) cogs += it.unit_cost * it.quantity;
    }
    p.netSales += net;
    p.cogs += cogs;
    p.grossProfit += net - cogs;
    p.orders += 1;
  }

  for (const e of expenses) {
    const d = businessDate(new Date(e.incurred_at));
    const p = map.get(d);
    if (!p) continue;
    p.expenses += e.amount;
  }

  for (const p of map.values()) {
    p.profit = p.grossProfit - p.expenses;
  }

  return days.map((d) => map.get(d)!);
}

export interface NameValue {
  name: string;
  value: number;
}

/** Net sales grouped by menu category (valid orders only). */
export function salesByCategory(orders: any[]): NameValue[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;
    for (const it of o.itemsDetailed ?? []) {
      const key = it.category_name ?? "Uncategorised";
      map.set(key, (map.get(key) ?? 0) + it.line_total);
    }
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Product leaderboards by quantity sold and by revenue. */
export function productLeaders(orders: any[]): {
  byQuantity: NameValue[];
  byRevenue: NameValue[];
} {
  const qty = new Map<string, number>();
  const rev = new Map<string, number>();
  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;
    for (const it of o.itemsDetailed ?? []) {
      qty.set(it.product_name, (qty.get(it.product_name) ?? 0) + it.quantity);
      rev.set(it.product_name, (rev.get(it.product_name) ?? 0) + it.line_total);
    }
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  return { byQuantity: top(qty), byRevenue: top(rev) };
}

/** Payment method distribution by net sales (valid orders only). */
export function paymentDistribution(orders: OrderRecord[]): NameValue[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;
    const key = o.payment_method.toUpperCase();
    map.set(key, (map.get(key) ?? 0) + (o.net_amount - o.refunded_amount));
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

/** Expenses grouped by category. */
export function expensesByCategory(expenses: ExpenseLike[]): NameValue[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const key = e.category_name ?? "Uncategorised";
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
