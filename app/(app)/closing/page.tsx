import { createClient } from "@/lib/supabase/server";
import { resolveRange, businessDate, formatIst } from "@/lib/datetime";
import { getOrdersInRange, getExpensesInRange } from "@/lib/queries";
import { buildClosing } from "@/lib/closing";
import { formatINR } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClosingActions } from "./closing-actions";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const date = one(searchParams.date) || businessDate();
  const range = resolveRange("custom", date, date);

  const [orders, expenses, { data: existing }] = await Promise.all([
    getOrdersInRange(supabase, range),
    getExpensesInRange(supabase, range),
    supabase.from("daily_closings").select("*").eq("business_date", date).maybeSingle(),
  ]);

  const c = buildClosing(orders as any, expenses as any);

  const rows: [string, string][] = [
    ["Total orders", String(c.orders)],
    ["Gross sales", formatINR(c.grossSales)],
    ["Discounts", `−${formatINR(c.discounts)}`],
    ["Refunds", `−${formatINR(c.refunds)}`],
    ["Net sales", formatINR(c.netSales)],
    ["Cash received", formatINR(c.cash)],
    ["UPI received", formatINR(c.upi)],
    ["Card received", formatINR(c.card)],
    ["Other received", formatINR(c.other)],
    ["Outstanding balances", formatINR(c.outstanding)],
    ["Total expenses", `−${formatINR(c.expenses)}`],
    ["COGS", `−${formatINR(c.cogs)}`],
    ["Gross profit", formatINR(c.grossProfit)],
    ["Estimated operating profit", formatINR(c.operatingProfit)],
  ];

  return (
    <div>
      <PageHeader
        title="Daily Closing"
        description={`End-of-day summary for ${formatIst(`${date}T06:00:00+05:30`, "EEEE, dd MMM yyyy")}`}
      >
        <ClosingActions date={date} snapshot={c as any} businessDate={businessDate()} />
      </PageHeader>

      {existing && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
          <Badge variant="accent">Closed</Badge>
          <span className="text-muted-foreground">
            Report generated {formatIst((existing as any).generated_at)}. Editing historical records
            for this day is still allowed but is tracked in the audit log.
          </span>
        </div>
      )}

      <div className="print-area grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Business summary</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="tnum font-medium">{value}</span>
              </div>
            ))}
            {c.cogsIncomplete && (
              <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                {c.itemsMissingCost} item(s) missing unit cost — COGS & profit are estimates.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Best-selling products</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {c.bestSellers.length === 0 && <p className="text-sm text-muted-foreground">No sales.</p>}
              {c.bestSellers.map((b) => (
                <div key={b.name} className="flex justify-between text-sm">
                  <span>{b.name}</span>
                  <span className="tnum text-muted-foreground">{b.value} sold</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expense breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {c.expenseBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No expenses.</p>}
              {c.expenseBreakdown.map((b) => (
                <div key={b.name} className="flex justify-between text-sm">
                  <span>{b.name}</span>
                  <span className="tnum text-muted-foreground">{formatINR(b.value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
