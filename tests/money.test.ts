import { describe, it, expect } from "vitest";
import {
  formatINR,
  rupeesToPaise,
  computeDiscountPaise,
  sumPaise,
} from "@/lib/money";

describe("money formatting (Indian numbering)", () => {
  it("formats whole rupees with lakh grouping and no decimals", () => {
    expect(formatINR(12500000)).toBe("₹1,25,000");
    expect(formatINR(6000)).toBe("₹60");
    expect(formatINR(0)).toBe("₹0");
  });

  it("shows two decimals only when there is a paise fraction", () => {
    expect(formatINR(6050)).toBe("₹60.50");
  });

  it("converts rupees to integer paise", () => {
    expect(rupeesToPaise(60)).toBe(6000);
    expect(rupeesToPaise(1.5)).toBe(150);
  });
});

describe("discount computation (integer paise)", () => {
  it("applies a flat discount in paise", () => {
    expect(computeDiscountPaise(12000, "flat", 2000)).toBe(2000);
  });
  it("applies a percentage discount, rounded to nearest paise", () => {
    expect(computeDiscountPaise(14000, "percent", 15)).toBe(2100); // 15% of 140
    expect(computeDiscountPaise(6000, "percent", 10)).toBe(600);
  });
  it("never exceeds the base or goes negative", () => {
    expect(computeDiscountPaise(5000, "flat", 999999)).toBe(5000);
    expect(computeDiscountPaise(5000, "flat", -100)).toBe(0);
    expect(computeDiscountPaise(5000, "percent", 150)).toBe(5000);
  });
  it("none => zero", () => {
    expect(computeDiscountPaise(5000, "none", 50)).toBe(0);
  });
});

describe("integer sums", () => {
  it("adds paise without float drift", () => {
    expect(sumPaise([10, 20, 30])).toBe(60);
    // classic float trap: 0.1 + 0.2 — but we work in integer paise
    expect(sumPaise([10, 20])).toBe(30);
  });
});
