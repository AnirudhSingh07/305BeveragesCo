/**
 * Finance engine — pure functions, integer-paise money, fully unit-tested.
 *
 * Definitions (mirrored in the SQL reporting views):
 *   Gross Sales  = Σ line totals of VALID (non-cancelled) orders, before discount/refund
 *   Discounts    = Σ order-level discounts on valid orders
 *   Refunds      = Σ valid refunds against valid orders
 *   Net Sales    = Gross Sales − Discounts − Refunds
 *   Outstanding  = Σ (net_amount − amount_paid) on valid orders, floored at 0 per order
 *   COGS         = Σ (unit_cost_snapshot × qty) over valid order items
 *   Gross Profit = Net Sales − COGS
 *   Operating Profit = Gross Profit − Operating Expenses
 *
 * Cancelled orders are NEVER counted as revenue. Unpaid orders ARE sales but
 * are NOT cash collected.
 */
import type { Paise } from "./money";
import { computeDiscountPaise, sumPaise } from "./money";
import type {
  CartLine,
  CartTotals,
  DiscountType,
  OrderRecord,
} from "./types";

/** Does this order count toward revenue? (cancelled orders do not) */
export function isRevenueOrder(o: Pick<OrderRecord, "status">): boolean {
  return o.status !== "cancelled";
}

/** Compute POS cart totals from live cart lines + an order-level discount. */
export function computeCartTotals(
  lines: CartLine[],
  discountType: DiscountType = "none",
  discountValue = 0
): CartTotals {
  const subtotal = sumPaise(lines.map((l) => l.price * l.quantity));
  const itemCount = lines.reduce((acc, l) => acc + l.quantity, 0);
  const discount = computeDiscountPaise(subtotal, discountType, discountValue);
  const total = Math.max(subtotal - discount, 0);
  return { itemCount, subtotal, discount, total };
}

/** Outstanding (unpaid) balance on a single order; 0 for cancelled orders. */
export function orderOutstanding(o: OrderRecord): Paise {
  if (!isRevenueOrder(o)) return 0;
  // Net owed = net_amount − refunded; collected = amount_paid.
  const owed = Math.max(o.net_amount - o.refunded_amount, 0);
  return Math.max(owed - o.amount_paid, 0);
}

/** Cash actually collected on a single order (capped at net of refunds). */
export function orderCashCollected(o: OrderRecord): Paise {
  if (!isRevenueOrder(o)) return 0;
  return Math.max(o.amount_paid - o.refunded_amount, 0);
}

export interface FinanceSummary {
  orderCount: number;
  itemsSold: number;
  grossSales: Paise;
  discounts: Paise;
  refunds: Paise;
  netSales: Paise;
  cogs: Paise;
  grossProfit: Paise;
  outstanding: Paise;
  averageOrderValue: Paise;
  /** True if any valid order item is missing a unit cost snapshot. */
  cogsIncomplete: boolean;
  /** Number of valid order items missing a unit cost snapshot. */
  itemsMissingCost: number;
}

/**
 * Aggregate a set of orders into the core sales/profit figures. Operating
 * expenses are added separately (see operatingProfit) to avoid double-counting.
 */
export function summarizeOrders(orders: OrderRecord[]): FinanceSummary {
  const valid = orders.filter(isRevenueOrder);

  const grossSales = sumPaise(valid.map((o) => o.gross_amount));
  const discounts = sumPaise(valid.map((o) => o.discount_amount));
  const refunds = sumPaise(valid.map((o) => o.refunded_amount));
  const netSales = grossSales - discounts - refunds;

  let cogs = 0;
  let itemsSold = 0;
  let itemsMissingCost = 0;
  for (const o of valid) {
    for (const it of o.items) {
      itemsSold += it.quantity;
      if (it.unit_cost === null || it.unit_cost === undefined) {
        itemsMissingCost += it.quantity;
      } else {
        cogs += it.unit_cost * it.quantity;
      }
    }
  }

  const grossProfit = netSales - cogs;
  const outstanding = sumPaise(valid.map(orderOutstanding));
  const orderCount = valid.length;
  const averageOrderValue =
    orderCount === 0 ? 0 : Math.round(netSales / orderCount);

  return {
    orderCount,
    itemsSold,
    grossSales,
    discounts,
    refunds,
    netSales,
    cogs,
    grossProfit,
    outstanding,
    averageOrderValue,
    cogsIncomplete: itemsMissingCost > 0,
    itemsMissingCost,
  };
}

/**
 * Estimated operating profit = Gross Profit − Operating Expenses.
 * Operating expenses are the period's recorded expenses (which must NOT
 * duplicate anything already captured as per-unit COGS).
 */
export function operatingProfit(
  summary: FinanceSummary,
  operatingExpenses: Paise
): Paise {
  return summary.grossProfit - operatingExpenses;
}

/** Cash collected across a set of orders (excludes cancelled). */
export function totalCashCollected(orders: OrderRecord[]): Paise {
  return sumPaise(orders.map(orderCashCollected));
}

/** Cash collected broken down by payment method (excludes cancelled). */
export function cashByMethod(orders: OrderRecord[]): Record<string, Paise> {
  const out: Record<string, Paise> = { cash: 0, upi: 0, card: 0, other: 0 };
  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;
    out[o.payment_method] =
      (out[o.payment_method] ?? 0) + orderCashCollected(o);
  }
  return out;
}
