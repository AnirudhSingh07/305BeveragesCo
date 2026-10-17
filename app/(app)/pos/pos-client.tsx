"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeCartTotals } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import type { CartLine, DiscountType, OrderPaymentMethod } from "@/lib/types";
import { newClientToken, createSubmissionGuard } from "@/lib/submission-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Receipt, type ReceiptData } from "@/components/receipt";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Printer,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  subgroup: string | null;
  sort_order: number;
}
interface Product {
  id: string;
  category_id: string;
  name: string;
  price_paise: number;
  cost_paise: number | null;
  is_available: boolean;
}

const PAYMENT_METHODS: OrderPaymentMethod[] = [
  "cash",
  "upi",
  "card",
  "other",
  "split",
];

const methodLabel = (m: OrderPaymentMethod) =>
  m === "split" ? "Cash + Online" : m.toUpperCase();

export function PosClient({
  categories,
  products,
  businessName,
  receiptHeader,
  receiptFooter,
}: {
  categories: Category[];
  products: Product[];
  businessName: string;
  receiptHeader: string | null;
  receiptFooter: string | null;
}) {
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const guard = useRef(createSubmissionGuard());
  const tokenRef = useRef(newClientToken());

  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountInput, setDiscountInput] = useState(""); // rupees (flat) or percent
  const [method, setMethod] = useState<OrderPaymentMethod>("cash");
  const [paidFull, setPaidFull] = useState(true);
  const [amountPaidInput, setAmountPaidInput] = useState(""); // rupees
  const [cashSplitInput, setCashSplitInput] = useState(""); // rupees (cash part of a split)
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState<ReceiptData | null>(null);

  const discountValuePaise =
    discountType === "flat" ? Math.round((parseFloat(discountInput) || 0) * 100) : 0;
  const discountPercent =
    discountType === "percent" ? parseFloat(discountInput) || 0 : 0;

  const totals = computeCartTotals(
    cart,
    discountType,
    discountType === "percent" ? discountPercent : discountValuePaise
  );

  // Split payment: part cash, the rest online (UPI). A split order is always
  // paid in full, so cash + online = total. The cash part is clamped to [0, total]
  // and the online part is whatever remains.
  const isSplit = method === "split";
  const cashSplitPaise = isSplit
    ? Math.min(
        Math.max(Math.round((parseFloat(cashSplitInput) || 0) * 100), 0),
        totals.total
      )
    : 0;
  const onlineSplitPaise = isSplit ? Math.max(totals.total - cashSplitPaise, 0) : 0;

  const amountPaidPaise = isSplit
    ? totals.total
    : paidFull
      ? totals.total
      : Math.round((parseFloat(amountPaidInput) || 0) * 100);

  const filtered = products.filter((p) => {
    if (search.trim()) {
      return p.name.toLowerCase().includes(search.trim().toLowerCase());
    }
    return p.category_id === activeCat;
  });

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          price: p.price_paise,
          unitCost: p.cost_paise,
          quantity: 1,
        },
      ];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + delta } : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function resetOrder() {
    setCart([]);
    setDiscountType("none");
    setDiscountInput("");
    setMethod("cash");
    setPaidFull(true);
    setAmountPaidInput("");
    setCashSplitInput("");
    setCustName("");
    setCustPhone("");
    setNotes("");
    tokenRef.current = newClientToken();
  }

  async function completeOrder() {
    if (cart.length === 0) {
      toast("Add at least one item to the cart.", "error");
      return;
    }
    // Prevent duplicate submissions.
    if (!guard.current.acquire()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("create_order", {
        p_items: cart.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        p_discount_type: discountType,
        p_discount_value:
          discountType === "percent" ? discountPercent : discountValuePaise,
        p_payment_method: method,
        // For a split, p_amount_paid carries the CASH part; the server records
        // the rest as UPI and marks the order fully paid.
        p_amount_paid: isSplit ? cashSplitPaise : amountPaidPaise,
        p_customer_name: custName.trim() || null,
        p_customer_phone: custPhone.trim() || null,
        p_notes: notes.trim() || null,
        p_client_token: tokenRef.current,
      });
      if (error) throw error;
      const order = (Array.isArray(data) ? data[0] : data) as any;
      const receipt: ReceiptData = {
        order_number: order.order_number,
        created_at: order.created_at,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        gross_amount: Number(order.gross_amount),
        discount_amount: Number(order.discount_amount),
        net_amount: Number(order.net_amount),
        amount_paid: Number(order.amount_paid),
        customer_name: order.customer_name,
        payments: isSplit
          ? [
              ...(cashSplitPaise > 0
                ? [{ method: "cash", amount: cashSplitPaise }]
                : []),
              ...(onlineSplitPaise > 0
                ? [{ method: "upi", amount: onlineSplitPaise }]
                : []),
            ]
          : undefined,
        items: cart.map((l) => ({
          product_name: l.name,
          quantity: l.quantity,
          unit_price: l.price,
          line_total: l.price * l.quantity,
        })),
      };
      setReview(false);
      setConfirmed(receipt);
      toast(`Order ${order.order_number} saved`, "success");
      resetOrder();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save order", "error");
    } finally {
      setSubmitting(false);
      guard.current.release();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* MENU */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search all products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {!search && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  activeCat === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="group flex min-h-[84px] flex-col justify-between rounded-xl border bg-card p-3 text-left transition-all hover:border-accent hover:shadow-sm active:scale-[0.98]"
            >
              <span className="text-sm font-medium leading-snug">{p.name}</span>
              <span className="mt-2 text-sm font-semibold text-accent tnum">
                {formatINR(p.price_paise)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No products found.
            </div>
          )}
        </div>
      </div>

      {/* CART */}
      <Card className="flex h-fit flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
        <div className="flex items-center gap-2 border-b p-4">
          <ShoppingCart className="h-5 w-5 text-accent" />
          <span className="font-semibold">Current Order</span>
          <span className="ml-auto text-sm text-muted-foreground tnum">
            {totals.itemCount} item{totals.itemCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Tap products to add them to the order.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((l) => (
                <div
                  key={l.productId}
                  className="flex items-center gap-2 rounded-lg border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground tnum">
                      {formatINR(l.price)} × {l.quantity} ={" "}
                      <span className="font-medium text-foreground">
                        {formatINR(l.price * l.quantity)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => changeQty(l.productId, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm tnum">{l.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => changeQty(l.productId, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLine(l.productId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary + checkout */}
        <div className="space-y-3 border-t p-4">
          <div className="flex items-center gap-2">
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No discount</SelectItem>
                <SelectItem value="percent">Discount %</SelectItem>
                <SelectItem value="flat">Discount ₹</SelectItem>
              </SelectContent>
            </Select>
            {discountType !== "none" && (
              <Input
                type="number"
                min={0}
                placeholder={discountType === "percent" ? "%" : "₹"}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                className="h-9"
              />
            )}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tnum">{formatINR(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tnum">-{formatINR(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tnum">{formatINR(totals.total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block text-xs">Payment</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as OrderPaymentMethod)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {methodLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              {isSplit ? (
                <>
                  <Label className="mb-1 block text-xs">Cash part</Label>
                  <Input
                    type="number"
                    min={0}
                    max={totals.total / 100}
                    placeholder="₹ cash"
                    value={cashSplitInput}
                    onChange={(e) => setCashSplitInput(e.target.value)}
                    className="h-9"
                  />
                </>
              ) : (
                <>
                  <Label className="mb-1 block text-xs">Amount paid</Label>
                  {paidFull ? (
                    <Button
                      variant="outline"
                      className="h-9 w-full justify-between"
                      onClick={() => {
                        setPaidFull(false);
                        setAmountPaidInput((totals.total / 100).toString());
                      }}
                    >
                      <span className="tnum">{formatINR(totals.total)}</span>
                      <span className="text-xs text-muted-foreground">Full</span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={amountPaidInput}
                        onChange={(e) => setAmountPaidInput(e.target.value)}
                        className="h-9"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setPaidFull(true)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {isSplit && (
            <div className="flex items-center justify-between rounded-md bg-secondary px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">Online (UPI)</span>
              <span className="tnum font-medium">{formatINR(onlineSplitPaise)}</span>
            </div>
          )}
          {!isSplit && !paidFull && amountPaidPaise < totals.total && (
            <div className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
              Balance due: {formatINR(Math.max(totals.total - amountPaidPaise, 0))}
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Customer &amp; notes (optional)
            </summary>
            <div className="mt-2 space-y-2">
              <Input
                placeholder="Customer name"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                className="h-9"
              />
              <Input
                placeholder="Phone"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                className="h-9"
              />
              <Textarea
                placeholder="Order notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </details>

          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={submitting || cart.length === 0}
            onClick={() => {
              if (cart.length === 0) {
                toast("Add at least one item to the cart.", "error");
                return;
              }
              setReview(true);
            }}
          >
            <CheckCircle2 className="h-5 w-5" />
            Review &amp; Complete · {formatINR(totals.total)}
          </Button>
        </div>
      </Card>

      {/* Review before saving */}
      <Dialog open={review} onOpenChange={(o) => !o && setReview(false)}>
        <DialogContent className="max-w-md">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Review order</h2>
            <p className="text-sm text-muted-foreground">
              Check the items and payment before saving.
            </p>
          </div>

          <div className="max-h-[45vh] space-y-1.5 overflow-y-auto rounded-lg border p-3 text-sm">
            {cart.map((l) => (
              <div key={l.productId} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {l.name} <span className="text-muted-foreground">× {l.quantity}</span>
                </span>
                <span className="tnum shrink-0">{formatINR(l.price * l.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tnum">{formatINR(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tnum">-{formatINR(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tnum">{formatINR(totals.total)}</span>
            </div>
            {isSplit ? (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment</span>
                  <span>Cash + Online</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cash</span>
                  <span className="tnum">{formatINR(cashSplitPaise)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Online (UPI)</span>
                  <span className="tnum">{formatINR(onlineSplitPaise)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment</span>
                  <span className="uppercase">{method}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Amount paid</span>
                  <span className="tnum">{formatINR(amountPaidPaise)}</span>
                </div>
                {amountPaidPaise < totals.total && (
                  <div className="flex justify-between font-medium text-amber-600 dark:text-amber-400">
                    <span>Balance due</span>
                    <span className="tnum">{formatINR(totals.total - amountPaidPaise)}</span>
                  </div>
                )}
              </>
            )}
            {custName.trim() && (
              <div className="flex justify-between text-muted-foreground">
                <span>Customer</span>
                <span className="truncate">{custName.trim()}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={submitting}
              onClick={() => setReview(false)}
            >
              Back &amp; edit
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              disabled={submitting}
              onClick={completeOrder}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              Confirm &amp; save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation */}
      <Dialog open={!!confirmed} onOpenChange={(o) => !o && setConfirmed(null)}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-1 text-center no-print">
            <CheckCircle2 className="h-10 w-10 text-accent" />
            <h2 className="text-lg font-semibold">Order Confirmed</h2>
            <p className="text-sm text-muted-foreground">{confirmed?.order_number}</p>
          </div>
          {confirmed && (
            <div className="print-area rounded-lg border">
              <Receipt
                data={confirmed}
                businessName={businessName}
                header={receiptHeader}
                footer={receiptFooter}
              />
            </div>
          )}
          <div className="flex gap-2 no-print">
            <Button variant="outline" className="flex-1" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="accent" className="flex-1" onClick={() => setConfirmed(null)}>
              New Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
