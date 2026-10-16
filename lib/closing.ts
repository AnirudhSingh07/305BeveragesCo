/** Build the end-of-day closing summary from a day's orders + expenses. */
import { summarizeOrders, operatingProfit, cashByMethod } from "./finance";
import { productLeaders, expensesByCategory, type ExpenseLike } from "./aggregate";
import type { OrderRecord } from "./types";

export interface ClosingSummary {
  orders: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  cash: number;
  upi: number;
  card: number;
  other: number;
  outstanding: number;
  expenses: number;
  cogs: number;
  grossProfit: number;
  operatingProfit: number;
  cogsIncomplete: boolean;
  itemsMissingCost: number;
  bestSellers: { name: string; value: number }[];
  expenseBreakdown: { name: string; value: number }[];
}

export function buildClosing(
  orders: OrderRecord[] & any[],
  expenses: ExpenseLike[]
): ClosingSummary {
  const s = summarizeOrders(orders);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const cash = cashByMethod(orders);
  const { byQuantity } = productLeaders(orders);
  return {
    orders: s.orderCount,
    grossSales: s.grossSales,
    discounts: s.discounts,
    refunds: s.refunds,
    netSales: s.netSales,
    cash: cash.cash,
    upi: cash.upi,
    card: cash.card,
    other: cash.other,
    outstanding: s.outstanding,
    expenses: expenseTotal,
    cogs: s.cogs,
    grossProfit: s.grossProfit,
    operatingProfit: operatingProfit(s, expenseTotal),
    cogsIncomplete: s.cogsIncomplete,
    itemsMissingCost: s.itemsMissingCost,
    bestSellers: byQuantity.slice(0, 5),
    expenseBreakdown: expensesByCategory(expenses),
  };
}
