import { describe, it, expect } from "vitest";
import {
  businessDate,
  resolveRange,
  istDayStartUtc,
  addIstDays,
} from "@/lib/datetime";

describe("12. date filtering respects Asia/Kolkata (05:00 day start)", () => {
  it("resolves the IST business date across the UTC day boundary", () => {
    // 2026-10-16T19:00:00Z is 2026-10-17 00:30 IST -> before 05:00, still the 16th
    expect(businessDate(new Date("2026-10-16T19:00:00Z"))).toBe("2026-10-16");
    // 2026-10-16T18:00:00Z is 2026-10-16 23:30 IST -> still the 16th
    expect(businessDate(new Date("2026-10-16T18:00:00Z"))).toBe("2026-10-16");
  });

  it("attributes the early-morning hours to the previous trading day", () => {
    // 04:59 IST on the 17th -> previous business day (the 16th)
    expect(businessDate(new Date("2026-10-16T23:29:00Z"))).toBe("2026-10-16");
    // 05:00 IST on the 17th -> the new business day starts (the 17th)
    expect(businessDate(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-17");
    // 05:01 IST on the 17th -> still the 17th
    expect(businessDate(new Date("2026-10-16T23:31:00Z"))).toBe("2026-10-17");
  });

  it("IST business-day start (05:00) maps to 23:30 UTC the previous day", () => {
    expect(istDayStartUtc("2026-10-17").toISOString()).toBe(
      "2026-10-16T23:30:00.000Z"
    );
  });

  it('"today" range is a 24h half-open window starting at 05:00 IST', () => {
    const now = new Date("2026-10-17T05:00:00Z"); // 10:30 IST on the 17th
    const r = resolveRange("today", undefined, undefined, now);
    expect(r.startUtc).toBe("2026-10-16T23:30:00.000Z"); // 05:00 IST on the 17th
    expect(r.endUtc).toBe("2026-10-17T23:30:00.000Z"); // 05:00 IST on the 18th
  });

  it("last7 covers 7 inclusive IST days", () => {
    const now = new Date("2026-10-17T05:00:00Z");
    const r = resolveRange("last7", undefined, undefined, now);
    expect(r.startUtc).toBe("2026-10-10T23:30:00.000Z"); // 05:00 IST on the 11th
    expect(r.endUtc).toBe("2026-10-17T23:30:00.000Z"); // 05:00 IST on the 18th
  });

  it("addIstDays wraps months correctly", () => {
    expect(addIstDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addIstDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});
