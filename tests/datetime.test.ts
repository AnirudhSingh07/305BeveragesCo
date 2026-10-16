import { describe, it, expect } from "vitest";
import {
  businessDate,
  resolveRange,
  istDayStartUtc,
  addIstDays,
} from "@/lib/datetime";

describe("12. date filtering respects Asia/Kolkata", () => {
  it("resolves the IST business date across the UTC day boundary", () => {
    // 2026-10-16T19:00:00Z is 2026-10-17 00:30 IST -> business date is the 17th
    expect(businessDate(new Date("2026-10-16T19:00:00Z"))).toBe("2026-10-17");
    // 2026-10-16T18:00:00Z is 2026-10-16 23:30 IST -> still the 16th
    expect(businessDate(new Date("2026-10-16T18:00:00Z"))).toBe("2026-10-16");
  });

  it("IST midnight maps to 18:30 UTC the previous day", () => {
    expect(istDayStartUtc("2026-10-17").toISOString()).toBe(
      "2026-10-16T18:30:00.000Z"
    );
  });

  it('"today" range is a 24h half-open window starting at IST midnight', () => {
    const now = new Date("2026-10-17T05:00:00Z"); // 10:30 IST on the 17th
    const r = resolveRange("today", undefined, undefined, now);
    expect(r.startUtc).toBe("2026-10-16T18:30:00.000Z");
    expect(r.endUtc).toBe("2026-10-17T18:30:00.000Z");
  });

  it("last7 covers 7 inclusive IST days", () => {
    const now = new Date("2026-10-17T05:00:00Z");
    const r = resolveRange("last7", undefined, undefined, now);
    expect(r.startUtc).toBe("2026-10-10T18:30:00.000Z"); // 2026-10-11 IST midnight... check below
    expect(r.endUtc).toBe("2026-10-17T18:30:00.000Z");
  });

  it("addIstDays wraps months correctly", () => {
    expect(addIstDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addIstDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});
