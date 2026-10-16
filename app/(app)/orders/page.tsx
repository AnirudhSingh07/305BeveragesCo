import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rangeFromParams } from "@/lib/range-params";
import { getOrdersInRange } from "@/lib/queries";
import { applyOrderFilters } from "@/lib/order-filter";
import { summarizeOrders } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import { formatIst } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { OrdersFilters } from "@/components/orders-filters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const statusBadge = (s: string) =>
  s === "paid" ? "success" : s === "partial" ? "warning" : "outline";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const { range } = rangeFromParams(searchParams);
  const [allOrders, { data: cats }] = await Promise.all([
    getOrdersInRange(supabase, range),
    supabase.from("categories").select("name").order("sort_order"),
  ]);
  const orders = applyOrderFilters(allOrders, searchParams);
  const summary = summarizeOrders(orders);

  const qs = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      v == null ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  ).toString();

  return (
    <div>
      <PageHeader title="Orders" description="Search, filter, and review every sale.">
        <Link href={`/api/export/orders?${qs}`}>
          <Button variant="outline"><Download className="h-4 w-4" /> Export CSV</Button>
        </Link>
        <Link href="/pos">
          <Button variant="accent"><Plus className="h-4 w-4" /> New Order</Button>
        </Link>
      </PageHeader>

      <OrdersFilters categories={(cats ?? []).map((c: any) => c.name)} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Matching orders</div><div className="text-lg font-semibold tnum">{summary.orderCount}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Net sales</div><div className="text-lg font-semibold tnum">{formatINR(summary.netSales)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Items sold</div><div className="text-lg font-semibold tnum">{summary.itemsSold}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-lg font-semibold tnum">{formatINR(summary.outstanding)}</div></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No orders match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Date &amp; time</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Net total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                        {o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatIst(o.created_at)}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground">
                      {o.itemsDetailed.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-medium tnum">
                      {formatINR(o.net_amount)}
                    </TableCell>
                    <TableCell className="uppercase text-muted-foreground">{o.payment_method}</TableCell>
                    <TableCell>
                      {o.status === "cancelled" ? (
                        <Badge variant="destructive">Cancelled</Badge>
                      ) : (
                        <Badge variant={statusBadge(o.payment_status) as any}>{o.payment_status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
