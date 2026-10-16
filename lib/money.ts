/**
 * Money utilities — 305 Beverages Co.
 *
 * All monetary values in this application are stored and computed as
 * INTEGER PAISE (1 rupee = 100 paise). This is the single, consistent money
 * unit across the database, server functions, and UI. Integer math avoids all
 * floating-point rounding errors in financial totals.
 *
 * Display uses the Indian numbering system (lakh/crore grouping), e.g.
 * 12500000 paise -> "₹1,25,000".
 */

/** A branded-ish alias to make intent explicit in signatures. */
export type Paise = number;

/** Convert whole/decimal rupees to integer paise. Rounds to nearest paise. */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

/** Convert integer paise to a rupee number (may be fractional). */
export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/**
 * Format integer paise as an Indian-Rupee string using the en-IN locale,
 * which produces lakh/crore grouping (e.g. ₹1,25,000). Whole-rupee amounts
 * show no decimals; fractional amounts show exactly two.
 */
export function formatINR(paise: Paise): string {
  const hasFraction = paise % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Format paise as a plain number string (no currency symbol), en-IN grouped. */
export function formatPaiseNumber(paise: Paise): string {
  const hasFraction = paise % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/**
 * Compute a discount amount in paise.
 *  - type "flat":    value is an amount in PAISE.
 *  - type "percent": value is a percentage (0–100); result is rounded to the
 *                    nearest paise.
 *  - type "none":    always 0.
 * The result is clamped to [0, base] so a discount can never exceed the base
 * or go negative.
 */
export function computeDiscountPaise(
  base: Paise,
  type: "none" | "flat" | "percent",
  value: number
): Paise {
  if (base <= 0) return 0;
  let discount = 0;
  if (type === "flat") {
    discount = Math.round(value);
  } else if (type === "percent") {
    const pct = Math.min(Math.max(value, 0), 100);
    discount = Math.round((base * pct) / 100);
  }
  return Math.min(Math.max(discount, 0), base);
}

/** Sum a list of paise values safely as integers. */
export function sumPaise(values: Paise[]): Paise {
  return values.reduce((acc, v) => acc + Math.round(v), 0);
}
