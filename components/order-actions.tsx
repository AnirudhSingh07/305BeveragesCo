"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Receipt, type ReceiptData } from "@/components/receipt";
import { Printer, IndianRupee, Undo2, Ban, Trash2, Loader2 } from "lucide-react";

export function OrderActions({
  order,
  businessName,
  header,
  footer,
}: {
  order: any;
  businessName: string;
  header: string | null;
  footer: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | "pay" | "refund" | "cancel" | "delete" | "receipt">(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reason, setReason] = useState("");

  const outstanding = Math.max(order.net_amount - order.refunded_amount - order.amount_paid, 0);

  const receiptData: ReceiptData = {
    order_number: order.order_number,
    created_at: order.created_at,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    gross_amount: order.gross_amount,
    discount_amount: order.discount_amount,
    net_amount: order.net_amount,
    amount_paid: order.amount_paid,
    refunded_amount: order.refunded_amount,
    customer_name: order.customer_name,
    items: order.itemsDetailed.map((i: any) => ({
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      line_total: i.line_total,
    })),
  };

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
      toast(ok, "success");
      setDialog(null);
      setAmount("");
      setReason("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("delete_order", {
        p_order_id: order.id,
        p_reason: reason || null,
      });
      if (error) throw error;
      toast(`Order ${order.order_number} deleted`, "success");
      // The order no longer exists — leave the detail page.
      router.replace("/orders");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
      setBusy(false);
    }
  }

  const cancelled = order.status === "cancelled";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setDialog("receipt")}>
          <Printer className="h-4 w-4" /> Receipt
        </Button>
        {!cancelled && outstanding > 0 && (
          <Button variant="outline" onClick={() => { setAmount((outstanding / 100).toString()); setDialog("pay"); }}>
            <IndianRupee className="h-4 w-4" /> Record payment
          </Button>
        )}
        {!cancelled && (
          <Button variant="outline" onClick={() => setDialog("refund")}>
            <Undo2 className="h-4 w-4" /> Refund
          </Button>
        )}
        {!cancelled && (
          <Button variant="destructive" onClick={() => setDialog("cancel")}>
            <Ban className="h-4 w-4" /> Cancel order
          </Button>
        )}
        <Button variant="destructive" onClick={() => { setReason(""); setDialog("delete"); }}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>

      {/* Record payment */}
      <Dialog open={dialog === "pay"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Outstanding balance: {formatINR(outstanding)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="accent"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    supabase.rpc("record_payment", {
                      p_order_id: order.id,
                      p_method: method,
                      p_amount: Math.round((parseFloat(amount) || 0) * 100),
                    }),
                  "Payment recorded"
                )
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund */}
      <Dialog open={dialog === "refund"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue refund</DialogTitle>
            <DialogDescription>
              Refunds reduce net sales. Max refundable: {formatINR(order.net_amount - order.refunded_amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    supabase.rpc("refund_order", {
                      p_order_id: order.id,
                      p_amount: Math.round((parseFloat(amount) || 0) * 100),
                      p_reason: reason || null,
                    }),
                  "Refund recorded"
                )
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Issue refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel */}
      <Dialog open={dialog === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              Cancelled orders are kept for history but excluded from all revenue and profit figures.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Cancellation reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Keep order</Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                run(
                  () => supabase.rpc("cancel_order", { p_order_id: order.id, p_reason: reason || null }),
                  "Order cancelled"
                )
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete (permanent) */}
      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this order permanently?</DialogTitle>
            <DialogDescription>
              This removes <span className="font-medium">{order.order_number}</span> and its items
              {(order.amount_paid > 0 || order.refunded_amount > 0) && (
                <>, including any recorded payments and refunds</>
              )}
              . This cannot be undone. Use <span className="font-medium">Cancel order</span> instead
              if you want to keep it for history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional, kept in the audit log)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. entered by mistake" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Keep order</Button>
            <Button variant="destructive" disabled={busy} onClick={handleDelete}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt reprint */}
      <Dialog open={dialog === "receipt"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <div className="print-area rounded-lg border">
            <Receipt data={receiptData} businessName={businessName} header={header} footer={footer} />
          </div>
          <DialogFooter className="no-print">
            <Button variant="accent" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
