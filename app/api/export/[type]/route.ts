import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rangeFromParams } from "@/lib/range-params";
import { getOrdersInRange, getExpensesInRange } from "@/lib/queries";
import { applyOrderFilters } from "@/lib/order-filter";
import { summarizeOrders, operatingProfit } from "@/lib/finance";
import { dailySeries } from "@/lib/aggregate";
import { toCsv, recordsToCsv } from "@/lib/csv";
import { formatIst } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/** Paise -> rupee number string with 2 decimals (spreadsheet friendly). */
const rs = (paise: number) => (paise / 100).toFixed(2);

function csvResponse(csv: string, filename: string) {
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { range } = rangeFromParams(sp);
  const type = params.type;

  try {
    if (type === "orders") {
      const orders = applyOrderFilters(await getOrdersInRange(supabase, range), sp);
      const csv = recordsToCsv(orders, [
        { header: "Order No", get: (o) => o.order_number },
        { header: "Date (IST)", get: (o) => formatIst(o.created_at, "yyyy-MM-dd HH:mm") },
        { header: "Status", get: (o) => o.status },
        { header: "Payment Status", get: (o) => o.payment_status },
        { header: "Payment Method", get: (o) => o.payment_method },
        { header: "Items", get: (o) => o.items.reduce((a, i) => a + i.quantity, 0) },
        { header: "Gross (INR)", get: (o) => rs(o.gross_amount) },
        { header: "Discount (INR)", get: (o) => rs(o.discount_amount) },
        { header: "Refunded (INR)", get: (o) => rs(o.refunded_amount) },
        { header: "Net (INR)", get: (o) => rs(o.net_amount) },
        { header: "Paid (INR)", get: (o) => rs(o.amount_paid) },
        { header: "Customer", get: (o) => o.customer_name ?? "" },
        { header: "Phone", get: (o) => o.customer_phone ?? "" },
      ]);
      return csvResponse(csv, "orders.csv");
    }

    if (type === "order-items") {
      const orders = applyOrderFilters(await getOrdersInRange(supabase, range), sp);
      const rows = orders.flatMap((o) =>
        o.itemsDetailed.map((it) => [
          o.order_number,
          formatIst(o.created_at, "yyyy-MM-dd HH:mm"),
          o.status,
          it.product_name,
          it.category_name ?? "",
          it.quantity,
          rs(it.unit_price),
          it.unit_cost == null ? "" : rs(it.unit_cost),
          rs(it.line_total),
        ])
      );
      const csv = toCsv(
        ["Order No", "Date (IST)", "Order Status", "Product", "Category", "Qty", "Unit Price (INR)", "Unit Cost (INR)", "Line Total (INR)"],
        rows
      );
      return csvResponse(csv, "order-items.csv");
    }

    if (type === "expenses") {
      const expenses = await getExpensesInRange(supabase, range);
      const csv = recordsToCsv(expenses, [
        { header: "Date (IST)", get: (e) => formatIst(e.incurred_at, "yyyy-MM-dd HH:mm") },
        { header: "Title", get: (e) => e.title },
        { header: "Category", get: (e) => e.category_name ?? "" },
        { header: "Amount (INR)", get: (e) => rs(e.amount) },
        { header: "Method", get: (e) => e.payment_method },
        { header: "Vendor", get: (e) => e.vendor ?? "" },
        { header: "Description", get: (e) => e.description ?? "" },
        { header: "Recurring", get: (e) => (e.is_recurring ? e.recurrence ?? "yes" : "no") },
      ]);
      return csvResponse(csv, "expenses.csv");
    }

    if (type === "menu") {
      const { data: products } = await supabase
        .from("products")
        .select("name, price_paise, cost_paise, is_available, categories(name)")
        .order("name");
      const csv = recordsToCsv(products ?? [], [
        { header: "Product", get: (p: any) => p.name },
        { header: "Category", get: (p: any) => p.categories?.name ?? "" },
        { header: "Price (INR)", get: (p: any) => rs(Number(p.price_paise)) },
        { header: "Unit Cost (INR)", get: (p: any) => (p.cost_paise == null ? "" : rs(Number(p.cost_paise))) },
        { header: "Available", get: (p: any) => (p.is_available ? "yes" : "no") },
      ]);
      return csvResponse(csv, "menu.csv");
    }

    if (type === "daily-summary") {
      const [orders, expenses] = await Promise.all([
        getOrdersInRange(supabase, range),
        getExpensesInRange(supabase, range),
      ]);
      const series = dailySeries(orders, expenses, range);
      const csv = recordsToCsv(series, [
        { header: "Date (IST)", get: (d) => d.date },
        { header: "Orders", get: (d) => d.orders },
        { header: "Net Sales (INR)", get: (d) => rs(d.netSales) },
        { header: "COGS (INR)", get: (d) => rs(d.cogs) },
        { header: "Gross Profit (INR)", get: (d) => rs(d.grossProfit) },
        { header: "Expenses (INR)", get: (d) => rs(d.expenses) },
        { header: "Est. Profit (INR)", get: (d) => rs(d.profit) },
      ]);
      return csvResponse(csv, "daily-summary.csv");
    }

    if (type === "pnl") {
      const [orders, expenses] = await Promise.all([
        getOrdersInRange(supabase, range),
        getExpensesInRange(supabase, range),
      ]);
      const s = summarizeOrders(orders);
      const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
      const op = operatingProfit(s, expenseTotal);
      const rows: [string, string][] = [
        ["Gross sales", rs(s.grossSales)],
        ["Discounts", rs(s.discounts)],
        ["Refunds", rs(s.refunds)],
        ["Net sales", rs(s.netSales)],
        ["Cost of goods sold", rs(s.cogs)],
        ["Gross profit", rs(s.grossProfit)],
        ["Operating expenses", rs(expenseTotal)],
        ["Estimated operating profit", rs(op)],
        ["Outstanding payments", rs(s.outstanding)],
        ["COGS complete", s.cogsIncomplete ? "NO (estimate)" : "yes"],
      ];
      return csvResponse(toCsv(["Metric", "Amount (INR)"], rows), "profit-and-loss.csv");
    }

    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
