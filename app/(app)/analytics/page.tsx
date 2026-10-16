import { createClient } from "@/lib/supabase/server";
import { rangeFromParams } from "@/lib/range-params";
import { getOrdersInRange, getExpensesInRange } from "@/lib/queries";
import { summarizeOrders, operatingProfit } from "@/lib/finance";
import { dailySeries, salesByCategory, productLeaders } from "@/lib/aggregate";
import { formatINR } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartCard,
  MoneyLineChart,
  MoneyBarChart,
  HorizontalMoneyBar,
} from "@/components/charts";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const { range } = rangeFromParams(searchParams);
  const [orders, expenses] = await Promise.all([
    getOrdersInRange(supabase, range),
    getExpensesInRange(supabase, range),
  ]);

  const s = summarizeOrders(orders);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const opProfit = operatingProfit(s, expenseTotal);
  const series = dailySeries(orders, expenses, range);
  const catSales = salesByCategory(orders);
  const { byRevenue } = productLeaders(orders);

  const qs = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      v == null ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  ).toString();

  const lines: { label: string; value: number; sign?: "minus"; strong?: boolean; result?: boolean }[] = [
    { label: "Gross sales", value: s.grossSales },
    { label: "Discounts", value: s.discounts, sign: "minus" },
    { label: "Refunds", value: s.refunds, sign: "minus" },
    { label: "Net sales", value: s.netSales, strong: true, result: true },
    { label: "Cost of goods sold (COGS)", value: s.cogs, sign: "minus" },
    { label: "Gross profit", value: s.grossProfit, strong: true, result: true },
    { label: "Operating expenses", value: expenseTotal, sign: "minus" },
    { label: "Estimated operating profit", value: opProfit, strong: true, result: true },
  ];

  return (
    <div>
      <PageHeader title="Analytics & Reports" description="Profit & loss and performance for the selected period.">
        <DateRangePicker />
        <a href={`/api/export/pnl?${qs}`}><Button variant="outline"><Download className="h-4 w-4" /> P&amp;L CSV</Button></a>
        <a href={`/api/export/daily-summary?${qs}`}><Button variant="outline"><Download className="h-4 w-4" /> Daily CSV</Button></a>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        <Card className="print-area">
          <CardHeader><CardTitle>Profit &amp; Loss statement</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {lines.map((l) => (
              <div
                key={l.label}
                className={cn(
                  "flex items-center justify-between py-1.5 text-sm",
                  l.result && "border-t pt-2.5",
                  l.strong ? "font-semibold" : "text-muted-foreground"
                )}
              >
                <span>{l.label}</span>
                <span className="tnum">
                  {l.sign === "minus" && l.value > 0 ? "−" : ""}
                  {formatINR(l.value)}
                </span>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
              <span className="text-muted-foreground">Outstanding payments</span>
              <span className="tnum font-medium">{formatINR(s.outstanding)}</span>
            </div>
            {s.cogsIncomplete && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                {s.itemsMissingCost} sold item(s) have no unit cost. COGS, gross profit, and
                operating profit are <strong>incomplete estimates</strong>. Enter unit costs in
                Menu Management for accurate figures.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <ChartCard title="Net sales over time" empty={s.netSales === 0}>
            <MoneyLineChart data={series} dataKey="netSales" color={0} />
          </ChartCard>
          <ChartCard title="Estimated profit over time" empty={!orders.length && !expenses.length}>
            <MoneyBarChart data={series} dataKey="profit" color={2} />
          </ChartCard>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Sales by category" empty={catSales.length === 0}>
          <HorizontalMoneyBar data={catSales} color={2} />
        </ChartCard>
        <ChartCard title="Top products by revenue" empty={byRevenue.length === 0}>
          <HorizontalMoneyBar data={byRevenue} color={1} />
        </ChartCard>
      </div>
    </div>
  );
}
