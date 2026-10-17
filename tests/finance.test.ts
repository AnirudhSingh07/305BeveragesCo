import { describe, it, expect } from "vitest";
import {
  computeCartTotals,
  summarizeOrders,
  operatingProfit,
  orderOutstanding,
  totalCashCollected,
  cashByMethod,
} from "@/lib/finance";
import type { CartLine, OrderRecord } from "@/lib/types";

const line = (price: number, qty: number, cost: number | null = null): CartLine => ({
  productId: crypto.randomUUID(),
  name: "x",
  price,
  unitCost: cost,
  quantity: qty,
});

describe("cart totals", () => {
  it("1. sums line totals correctly", () => {
    const t = computeCartTotals([line(6000, 2), line(12000, 1)]);
    expect(t.subtotal).toBe(24000);
    expect(t.itemCount).toBe(3);
    expect(t.total).toBe(24000);
  });

  it("2. increasing/decreasing quantity changes totals", () => {
    expect(computeCartTotals([line(6000, 1)]).total).toBe(6000);
    expect(computeCartTotals([line(6000, 3)]).total).toBe(18000);
  });

  it("3. applies flat and percent discounts", () => {
    expect(computeCartTotals([line(6000, 2)], "flat", 2000).total).toBe(10000);
    expect(computeCartTotals([line(10000, 1)], "percent", 10).total).toBe(9000);
  });
});

function order(partial: Partial<OrderRecord>): OrderRecord {
  return {
    id: crypto.randomUUID(),
    order_number: "ORD-1",
    status: "completed",
    payment_status: "paid",
    payment_method: "cash",
    gross_amount: 0,
    discount_amount: 0,
    net_amount: 0,
    amount_paid: 0,
    refunded_amount: 0,
    created_at: new Date().toISOString(),
    items: [],
    ...partial,
  };
}

describe("revenue & profit engine", () => {
  it("6. excludes cancelled orders from revenue", () => {
    const s = summarizeOrders([
      order({ gross_amount: 10000, net_amount: 10000, status: "completed", items: [{ quantity: 1, unit_price: 10000, unit_cost: 4000 }] }),
      order({ gross_amount: 99999, net_amount: 99999, status: "cancelled", items: [{ quantity: 1, unit_price: 99999, unit_cost: 0 }] }),
    ]);
    expect(s.grossSales).toBe(10000);
    expect(s.orderCount).toBe(1);
    expect(s.itemsSold).toBe(1);
  });

  it("7. refunds reduce net sales", () => {
    const s = summarizeOrders([
      order({ gross_amount: 10000, discount_amount: 0, net_amount: 10000, refunded_amount: 2500 }),
    ]);
    expect(s.netSales).toBe(7500);
  });

  it("net sales = gross - discounts - refunds", () => {
    const s = summarizeOrders([
      order({ gross_amount: 20000, discount_amount: 3000, net_amount: 17000, refunded_amount: 1000 }),
    ]);
    expect(s.grossSales).toBe(20000);
    expect(s.discounts).toBe(3000);
    expect(s.refunds).toBe(1000);
    expect(s.netSales).toBe(16000);
  });

  it("8. outstanding = net - refunds - amount paid, floored per order", () => {
    const o = order({ net_amount: 12000, amount_paid: 5000, refunded_amount: 0, payment_status: "partial" });
    expect(orderOutstanding(o)).toBe(7000);
    // overpaid / fully paid never negative
    expect(orderOutstanding(order({ net_amount: 12000, amount_paid: 12000 }))).toBe(0);
    // cancelled has no outstanding
    expect(orderOutstanding(order({ net_amount: 12000, amount_paid: 0, status: "cancelled" }))).toBe(0);
  });

  it("10. flags missing unit costs for COGS", () => {
    const s = summarizeOrders([
      order({ gross_amount: 12000, net_amount: 12000, items: [
        { quantity: 1, unit_price: 12000, unit_cost: null },
        { quantity: 2, unit_price: 0, unit_cost: 4000 },
      ] }),
    ]);
    expect(s.cogsIncomplete).toBe(true);
    expect(s.itemsMissingCost).toBe(1);
    expect(s.cogs).toBe(8000); // only the item with a known cost (2 * 4000)
  });

  it("gross profit = net sales - COGS using snapshots", () => {
    const s = summarizeOrders([
      order({ gross_amount: 12000, net_amount: 12000, items: [
        { quantity: 1, unit_price: 12000, unit_cost: 4500 },
      ] }),
    ]);
    expect(s.netSales).toBe(12000);
    expect(s.cogs).toBe(4500);
    expect(s.grossProfit).toBe(7500); // mirrors the ₹120 sell / ₹45 cost example
  });

  it("11. operating profit does not double-count COGS", () => {
    const s = summarizeOrders([
      order({ gross_amount: 12000, net_amount: 12000, items: [
        { quantity: 1, unit_price: 12000, unit_cost: 4500 },
      ] }),
    ]);
    // gross profit 7500; operating expenses 2000 (not part of COGS)
    expect(operatingProfit(s, 2000)).toBe(5500);
  });

  it("distinguishes cash collected from sales recognised", () => {
    const orders = [
      order({ net_amount: 10000, amount_paid: 10000, payment_method: "upi" }),
      order({ net_amount: 8000, amount_paid: 3000, payment_method: "cash", payment_status: "partial" }),
      order({ net_amount: 5000, amount_paid: 0, payment_status: "unpaid", payment_method: "cash" }),
    ];
    expect(totalCashCollected(orders)).toBe(13000); // 10000 + 3000 + 0
    const byMethod = cashByMethod(orders);
    expect(byMethod.upi).toBe(10000);
    expect(byMethod.cash).toBe(3000);
  });

  it("splits a mixed-payment order across cash and online in the breakdown", () => {
    const orders = [
      order({
        net_amount: 10000,
        amount_paid: 10000,
        payment_method: "split",
        payments: [
          { method: "cash", amount: 3000 },
          { method: "upi", amount: 7000 },
        ],
      }),
    ];
    expect(totalCashCollected(orders)).toBe(10000);
    const byMethod = cashByMethod(orders);
    expect(byMethod.cash).toBe(3000);
    expect(byMethod.upi).toBe(7000);
    expect(byMethod.card).toBe(0);
  });

  it("nets a refund out of a split order proportionally (parts still sum)", () => {
    const orders = [
      order({
        net_amount: 10000,
        amount_paid: 10000,
        refunded_amount: 1000,
        payment_method: "split",
        payments: [
          { method: "cash", amount: 4000 },
          { method: "upi", amount: 6000 },
        ],
      }),
    ];
    const byMethod = cashByMethod(orders);
    // collected = 10000 - 1000 = 9000, split 40/60 → 3600 / 5400
    expect(byMethod.cash).toBe(3600);
    expect(byMethod.upi).toBe(5400);
    expect(byMethod.cash + byMethod.upi).toBe(9000);
  });
});
