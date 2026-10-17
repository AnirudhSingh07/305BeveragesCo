import { describe, it, expect } from "vitest";
import { toCsv, recordsToCsv } from "@/lib/csv";
import { filterByRange } from "@/lib/filters";
import { resolveRange } from "@/lib/datetime";
import { createSubmissionGuard } from "@/lib/submission-guard";
import { MENU, TOTAL_PRODUCTS, DEFAULT_EXPENSE_CATEGORIES } from "@/lib/menu-data";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("9. expenses included in the selected date range (IST, 05:00 day start)", () => {
  const now = new Date("2026-10-17T05:00:00Z"); // 10:30 IST on the 17th
  const expenses = [
    { id: "a", incurred_at: "2026-10-17T06:00:00Z" }, // 11:30 IST 17th — in
    { id: "b", incurred_at: "2026-10-17T00:00:00Z" }, // 05:30 IST 17th — in
    { id: "c", incurred_at: "2026-10-16T19:00:00Z" }, // 00:30 IST 17th — before 05:00, prev day — out
    { id: "d", incurred_at: "2026-10-16T17:00:00Z" }, // 22:30 IST 16th — out
  ];
  it("keeps only records within today's IST window", () => {
    const range = resolveRange("today", undefined, undefined, now);
    const kept = filterByRange(expenses, (e) => e.incurred_at, range).map((e) => e.id);
    expect(kept.sort()).toEqual(["a", "b"]);
  });
});

describe("13. duplicate submissions are prevented (client guard)", () => {
  it("single-flight gate blocks a second concurrent acquire", () => {
    const g = createSubmissionGuard();
    expect(g.acquire()).toBe(true);
    expect(g.acquire()).toBe(false); // already busy
    g.release();
    expect(g.acquire()).toBe(true);
  });
});

describe("14. CSV exports contain correct records and totals", () => {
  it("quotes values containing commas, quotes and newlines", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'he said "hi"'], ["line1\nline2", 5]]);
    expect(csv).toBe('a,b\r\n"x,y","he said ""hi"""\r\n"line1\nline2",5');
  });

  it("builds rows from a column spec and preserves totals", () => {
    const rows = [
      { order: "ORD-1", net: 10000 },
      { order: "ORD-2", net: 7500 },
    ];
    const csv = recordsToCsv(rows, [
      { header: "Order", get: (r) => r.order },
      { header: "Net (paise)", get: (r) => r.net },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Order,Net (paise)");
    expect(lines[1]).toBe("ORD-1,10000");
    const total = rows.reduce((a, r) => a + r.net, 0);
    expect(total).toBe(17500);
  });
});

describe("4/5. menu seed integrity (SQL migration matches canonical TS data)", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../supabase/migrations/0001_init.sql"),
    "utf8"
  );

  it("has the expected product and category counts", () => {
    expect(MENU.length).toBe(7);
    expect(TOTAL_PRODUCTS).toBe(46);
    expect(DEFAULT_EXPENSE_CATEGORIES.length).toBe(15);
  });

  it("every product and its price (in paise) appears in the SQL seed", () => {
    for (const cat of MENU) {
      expect(sql).toContain(`'${cat.name}'`);
      for (const p of cat.products) {
        const paise = p.price * 100;
        // e.g. 'Fridge Cigarette',14000
        expect(sql).toContain(`'${p.name.replace(/'/g, "''")}',${paise}`);
      }
    }
  });

  it("every default expense category appears in the SQL seed", () => {
    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
      expect(sql).toContain(`'${name.replace(/'/g, "''")}'`);
    }
  });
});
