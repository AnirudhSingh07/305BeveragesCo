"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Trash2, Loader2 } from "lucide-react";

/**
 * Per-row "delete order" action for the Orders list. Permanently removes a
 * mistaken order via the audit-logged `delete_order` RPC, then refreshes the
 * list in place. Distinct from Cancel (which keeps the order for history).
 */
export function DeleteOrderButton({
  orderId,
  orderNumber,
  hasMoney,
}: {
  orderId: string;
  orderNumber: string;
  hasMoney: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  async function handleDelete() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("delete_order", {
        p_order_id: orderId,
        p_reason: reason || null,
      });
      if (error) throw error;
      toast(`Order ${orderNumber} deleted`, "success");
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-destructive"
        title="Delete order"
        aria-label={`Delete order ${orderNumber}`}
        onClick={() => {
          setReason("");
          setOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this order permanently?</DialogTitle>
            <DialogDescription>
              This removes <span className="font-medium">{orderNumber}</span> and its items
              {hasMoney && <>, including any recorded payments and refunds</>}. This cannot be
              undone. Use <span className="font-medium">Cancel order</span> (on the order page)
              instead if you want to keep it for history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (optional, kept in the audit log)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. entered by mistake"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep order
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleDelete}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
