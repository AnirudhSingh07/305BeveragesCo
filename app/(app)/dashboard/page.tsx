import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rangeFromParams } from "@/lib/range-params";
import { getOrdersInRange, getExpensesInRange } from "@/lib/queries";
import { summarizeOrders, operatingProfit } from "@/lib/finance";
import {
  dailySeries,
  salesByCategory,
  productLeaders,
  paymentDistribution,
  expensesByCategory,
} from "@/lib/aggregate";
import { formatINR } from "@/lib/money";
import { formatIst } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartCard,
  MoneyLineChart,
  CountBarChart,
  MoneyBarChart,
  HorizontalMoneyBar,
  DonutChart,
} from "@/components/charts";
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Layers,
  Receipt,
  Wallet,
  PiggyBank,
  Clock,
  Plus,
} from "lucide-react";

export const dynamic = "force-dynamic";

const statusBadge = (s: string) =>
  s === "paid" ? "success" : s === "partial" ? "warning" : s === "unpaid" ? "outline" : "destructive";

export default async function DashboardPage({
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

  const summary = summarizeOrders(orders);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const opProfit = operatingProfit(summary, expenseTotal);

  const series = dailySeries(orders, expenses, range);
  const catSales = salesByCategory(orders);
  const { byQuantity, byRevenue } = productLeaders(orders);
  const payDist = paymentDistribution(orders);
  const expCat = expensesByCategory(expenses);

  const hasData = orders.length > 0 || expenses.length > 0;
  const recent = orders.slice(0, 8);

  return (
    <div>
      <PageHeader title="Dashboard" description="Your business at a glance.">
        <DateRangePicker />
        <Link href="/pos">
          <Button variant="accent">
            <Plus className="h-4 w-4" /> New Order
          </Button>
        </Link>
      </PageHeader>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">No activity in this period yet</h3>
              <p className="text-sm text-muted-foreground">
                Take your first order to see live sales and profit here.
              </p>
            </div>
            <Link href="/pos">
              <Button variant="accent">
                <Plus className="h-4 w-4" /> Create first order
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Gross Sales" value={formatINR(summary.grossSales)} icon={IndianRupee} />
            <KpiCard label="Net Sales" value={formatINR(summary.netSales)} tone="accent" icon={TrendingUp} hint={`Disc ${formatINR(summary.discounts)} · Ref ${formatINR(summary.refunds)}`} />
            <KpiCard label="Orders" value={String(summary.orderCount)} icon={ShoppingBag} />
            <KpiCard label="Avg Order Value" value={formatINR(summary.averageOrderValue)} icon={Receipt} />
            <KpiCard label="Items Sold" value={String(summary.itemsSold)} icon={Layers} />
            <KpiCard label="Expenses" value={formatINR(expenseTotal)} tone="warning" icon={Wallet} />
            <KpiCard
              label="Est. Profit"
              value={formatINR(opProfit)}
              tone={opProfit >= 0 ? "accent" : "destructive"}
              icon={PiggyBank}
              hint={summary.cogsIncomplete ? "COGS incomplete — estimate" : "Net − COGS − expenses"}
            />
            <KpiCard label="Outstanding" value={formatINR(summary.outstanding)} tone="destructive" icon={Clock} />
          </div>

          {summary.cogsIncomplete && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
              {summary.itemsMissingCost} sold item(s) have no unit cost set. Gross profit and
              estimated profit are incomplete estimates until costs are entered in{" "}
              <Link href="/menu" className="font-medium underline">Menu Management</Link>.
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue over time (net sales)" empty={summary.netSales === 0}>
              <MoneyLineChart data={series} dataKey="netSales" color={0} />
            </ChartCard>
            <ChartCard title="Orders over time" empty={summary.orderCount === 0}>
              <CountBarChart data={series} dataKey="orders" color={3} />
            </ChartCard>
            <ChartCard title="Sales by category" empty={catSales.length === 0}>
              <HorizontalMoneyBar data={catSales} color={2} />
            </ChartCard>
            <ChartCard title="Payment methods (net sales)" empty={payDist.length === 0}>
              <DonutChart data={payDist} />
            </ChartCard>
            <ChartCard title="Best sellers (by quantity)" empty={byQuantity.length === 0}>
              <HorizontalMoneyBar data={byQuantity} color={0} isCount />
            </ChartCard>
            <ChartCard title="Top products (by revenue)" empty={byRevenue.length === 0}>
              <HorizontalMoneyBar data={byRevenue} color={1} />
            </ChartCard>
            <ChartCard title="Daily expenses" empty={expenseTotal === 0}>
              <MoneyBarChart data={series} dataKey="expenses" color={5} />
            </ChartCard>
            <ChartCard title="Daily estimated profit" empty={!hasData}>
              <MoneyBarChart data={series} dataKey="profit" color={2} />
            </ChartCard>
          </div>

          {expCat.length > 0 && (
            <ChartCard title="Highest expense categories">
              <HorizontalMoneyBar data={expCat} color={5} />
            </ChartCard>
          )}

          {/* Recent orders */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent orders</CardTitle>
              <Link href="/orders" className="text-sm text-accent hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                          {o.order_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatIst(o.created_at, "hh:mm a")}
                      </TableCell>
                      <TableCell className="text-muted-foreground tnum">
                        {o.items.reduce((a, i) => a + i.quantity, 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium tnum">
                        {formatINR(o.net_amount)}
                      </TableCell>
                      <TableCell className="uppercase text-muted-foreground">
                        {o.payment_method}
                      </TableCell>
                      <TableCell>
                        {o.status === "cancelled" ? (
                          <Badge variant="destructive">Cancelled</Badge>
                        ) : (
                          <Badge variant={statusBadge(o.payment_status) as any}>
                            {o.payment_status}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
