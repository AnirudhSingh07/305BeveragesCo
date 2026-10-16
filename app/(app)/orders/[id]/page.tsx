import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { formatIst } from "@/lib/datetime";
import { PageHeader } from "@/components/page-header";
import { OrderActions } from "@/components/order-actions";
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
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const [order, { data: biz }] = await Promise.all([
    getOrderById(supabase, params.id),
    supabase.from("businesses").select("name, receipt_header, receipt_footer").limit(1).maybeSingle(),
  ]);
  if (!order) notFound();

  const outstanding = Math.max(order.net_amount - order.refunded_amount - order.amount_paid, 0);
  const missingCost = order.itemsDetailed.some((i) => i.unit_cost == null);

  return (
    <div>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <PageHeader
        title={order.order_number}
        description={formatIst(order.created_at)}
      >
        <OrderActions
          order={order}
          businessName={biz?.name ?? "305 Beverages Co."}
          header={biz?.receipt_header ?? null}
          footer={biz?.receipt_footer ?? null}
        />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {order.status === "cancelled" ? (
          <Badge variant="destructive">Cancelled</Badge>
        ) : (
          <Badge variant={order.payment_status === "paid" ? "success" : order.payment_status === "partial" ? "warning" : "outline"}>
            {order.payment_status}
          </Badge>
        )}
        <Badge variant="outline" className="uppercase">{order.payment_method}</Badge>
        {order.customer_name && <Badge variant="default">{order.customer_name}</Badge>}
        {order.customer_phone && <Badge variant="default">{order.customer_phone}</Badge>}
      </div>

      {order.status === "cancelled" && order.cancel_reason && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm">
          <span className="font-medium">Cancelled:</span> {order.cancel_reason}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Itemised bill</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.itemsDetailed.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      {it.product_name}
                      {it.category_name && (
                        <span className="ml-2 text-xs text-muted-foreground">{it.category_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tnum">{formatINR(it.unit_price)}</TableCell>
                    <TableCell className="text-center tnum">{it.quantity}</TableCell>
                    <TableCell className="text-right tnum text-muted-foreground">
                      {it.unit_cost == null ? "—" : formatINR(it.unit_cost)}
                    </TableCell>
                    <TableCell className="text-right font-medium tnum">{formatINR(it.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {missingCost && (
              <div className="border-t px-4 py-2 text-xs text-amber-600 dark:text-amber-400">
                Some items have no cost snapshot — profit for this order is an incomplete estimate.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Gross" value={formatINR(order.gross_amount)} />
              <Row label="Discount" value={`-${formatINR(order.discount_amount)}`} />
              <Row label="Refunded" value={`-${formatINR(order.refunded_amount)}`} />
              <div className="my-1 border-t" />
              <Row label="Net total" value={formatINR(order.net_amount)} bold />
              <Row label="Amount paid" value={formatINR(order.amount_paid)} />
              <Row label="Outstanding" value={formatINR(outstanding)} bold />
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{order.notes}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Payment records</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.payments.length === 0 && <p className="text-muted-foreground">No payments recorded.</p>}
              {order.payments.map((p: any) => (
                <div key={p.id} className="flex justify-between">
                  <span className="uppercase text-muted-foreground">{p.method} · {formatIst(p.created_at, "dd MMM hh:mm a")}</span>
                  <span className="tnum">{formatINR(Number(p.amount))}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {order.refunds.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Refund history</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {order.refunds.map((r: any) => (
                  <div key={r.id} className="flex justify-between">
                    <span className="text-muted-foreground">{r.reason || "Refund"} · {formatIst(r.created_at, "dd MMM hh:mm a")}</span>
                    <span className="tnum">-{formatINR(Number(r.amount))}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
