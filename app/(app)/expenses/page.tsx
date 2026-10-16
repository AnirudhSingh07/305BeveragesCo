import { createClient } from "@/lib/supabase/server";
import { rangeFromParams } from "@/lib/range-params";
import { getExpensesInRange } from "@/lib/queries";
import { resolveRange } from "@/lib/datetime";
import { dailySeries, expensesByCategory } from "@/lib/aggregate";
import { formatINR } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker } from "@/components/date-range-picker";
import { KpiCard } from "@/components/kpi-card";
import { ChartCard, MoneyBarChart, HorizontalMoneyBar } from "@/components/charts";
import { ExpensesClient } from "./expenses-client";
import { Wallet, CalendarDays, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const { range } = rangeFromParams(searchParams);
  const todayRange = resolveRange("today");

  const [periodExpenses, todayExpenses, { data: cats }] = await Promise.all([
    getExpensesInRange(supabase, range),
    getExpensesInRange(supabase, todayRange),
    supabase.from("expense_categories").select("*").order("name"),
  ]);

  const periodTotal = periodExpenses.reduce((a, e) => a + e.amount, 0);
  const todayTotal = todayExpenses.reduce((a, e) => a + e.amount, 0);
  const byCat = expensesByCategory(periodExpenses);
  const series = dailySeries([], periodExpenses, range);

  const qs = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      v == null ? [] : [[k, Array.isArray(v) ? v[0] : v]]
    ) as [string, string][]
  ).toString();

  return (
    <div>
      <PageHeader title="Expenses" description="Track every cost of running the business.">
        <DateRangePicker />
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Today's expenses" value={formatINR(todayTotal)} icon={CalendarDays} tone="warning" />
        <KpiCard label="Period expenses" value={formatINR(periodTotal)} icon={Wallet} />
        <KpiCard label="Categories used" value={String(byCat.length)} icon={Layers} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Expenses over time" empty={periodTotal === 0}>
          <MoneyBarChart data={series} dataKey="expenses" color={5} />
        </ChartCard>
        <ChartCard title="Highest expense categories" empty={byCat.length === 0}>
          <HorizontalMoneyBar data={byCat} color={5} />
        </ChartCard>
      </div>

      <ExpensesClient
        expenses={periodExpenses as any}
        categories={(cats ?? []) as any}
        exportQs={qs}
      />
    </div>
  );
}
