/** Shared domain types. Money fields are always integer paise. */
import type { Paise } from "./money";

export type OrderStatus = "completed" | "cancelled";
export type PaymentStatus = "paid" | "unpaid" | "partial";
export type PaymentMethod = "cash" | "upi" | "card" | "other";
export type DiscountType = "none" | "flat" | "percent";

export interface Category {
  id: string;
  name: string;
  subgroup: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  /** Selling price, integer paise. */
  price: Paise;
  /** Unit cost (COGS), integer paise. Null = not configured. */
  unit_cost: Paise | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

/** A line in the live POS cart (client-side state before the order is saved). */
export interface CartLine {
  productId: string;
  name: string;
  /** Snapshot of current selling price, paise. */
  price: Paise;
  /** Snapshot of current unit cost, paise (or null if unknown). */
  unitCost: Paise | null;
  quantity: number;
}

export interface CartTotals {
  itemCount: number;
  /** Sum of line totals (price * qty) before discount. */
  subtotal: Paise;
  discount: Paise;
  /** subtotal - discount, floored at 0. */
  total: Paise;
}

/** Persisted order-item snapshot used by the reporting engine. */
export interface OrderItemSnapshot {
  quantity: number;
  unit_price: Paise;
  unit_cost: Paise | null;
}

/** Minimal persisted order shape used by the reporting engine. */
export interface OrderRecord {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  /** Sum of line totals before discount, paise. */
  gross_amount: Paise;
  /** Discount applied to the order, paise. */
  discount_amount: Paise;
  /** Net payable (gross - discount), paise. */
  net_amount: Paise;
  /** Amount actually collected so far, paise. */
  amount_paid: Paise;
  /** Total valid refunds issued against this order, paise. */
  refunded_amount: Paise;
  created_at: string;
  items: OrderItemSnapshot[];
}
