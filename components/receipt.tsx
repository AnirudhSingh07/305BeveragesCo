"use client";

import { formatINR } from "@/lib/money";
import { formatIst } from "@/lib/datetime";

export interface ReceiptData {
  order_number: string;
  created_at: string;
  payment_method: string;
  payment_status: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  amount_paid: number;
  refunded_amount?: number;
  /** Per-method breakdown; when present (e.g. a split order) it's shown instead
   *  of a single "Paid (METHOD)" line. */
  payments?: { method: string; amount: number }[];
  customer_name?: string | null;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
}

/** A compact, print-friendly thermal-style receipt. */
export function Receipt({
  data,
  businessName,
  header,
  footer,
}: {
  data: ReceiptData;
  businessName: string;
  header?: string | null;
  footer?: string | null;
}) {
  const outstanding = Math.max(
    data.net_amount - (data.refunded_amount ?? 0) - data.amount_paid,
    0
  );
  return (
    <div className="mx-auto w-[300px] bg-white p-4 font-mono text-[12px] leading-tight text-black">
      <div className="text-center">
        <div className="text-base font-bold uppercase">{businessName}</div>
        {header && <div className="mt-0.5 whitespace-pre-line text-[11px]">{header}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Order</span>
        <span className="font-bold">{data.order_number}</span>
      </div>
      <div className="flex justify-between">
        <span>Date</span>
        <span>{formatIst(data.created_at, "dd/MM/yy hh:mm a")}</span>
      </div>
      {data.customer_name && (
        <div className="flex justify-between">
          <span>Customer</span>
          <span>{data.customer_name}</span>
        </div>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="text-left font-normal">Item</th>
            <th className="text-center font-normal">Qty</th>
            <th className="text-right font-normal">Amt</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i}>
              <td className="py-0.5 pr-1">{it.product_name}</td>
              <td className="text-center">{it.quantity}</td>
              <td className="text-right">{formatINR(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatINR(data.gross_amount)}</span>
      </div>
      {data.discount_amount > 0 && (
        <div className="flex justify-between">
          <span>Discount</span>
          <span>-{formatINR(data.discount_amount)}</span>
        </div>
      )}
      {(data.refunded_amount ?? 0) > 0 && (
        <div className="flex justify-between">
          <span>Refunded</span>
          <span>-{formatINR(data.refunded_amount ?? 0)}</span>
        </div>
      )}
      <div className="mt-1 flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatINR(data.net_amount)}</span>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      {data.payments && data.payments.length > 0 ? (
        data.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>Paid ({p.method.toUpperCase()})</span>
            <span>{formatINR(p.amount)}</span>
          </div>
        ))
      ) : (
        <div className="flex justify-between">
          <span>Paid ({data.payment_method.toUpperCase()})</span>
          <span>{formatINR(data.amount_paid)}</span>
        </div>
      )}
      {outstanding > 0 && (
        <div className="flex justify-between font-bold">
          <span>Balance Due</span>
          <span>{formatINR(outstanding)}</span>
        </div>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center text-[11px]">
        {footer || "Thank you! Visit again."}
      </div>
    </div>
  );
}
