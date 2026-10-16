"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/money";
import { formatIst } from "@/lib/datetime";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

/** Compact INR for axes, e.g. ₹1.2L, ₹3.4k. Input is paise. */
export function compactINR(paise: number): string {
  const r = paise / 100;
  if (Math.abs(r) >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (Math.abs(r) >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (Math.abs(r) >= 1e3) return `₹${(r / 1e3).toFixed(1)}k`;
  return `₹${r.toFixed(0)}`;
}

const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 tnum">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {p.dataKey === "orders" || p.dataKey === "value" && p.unit === "count"
              ? p.value
              : formatINR(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="tnum">
          <span className="text-muted-foreground">{p.name}: </span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No data for this period.
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

const dayLabel = (d: string) => formatIst(`${d}T00:00:00+05:30`, "dd MMM");

export function MoneyLineChart({ data, dataKey, color = 0 }: { data: any[]; dataKey: string; color?: number }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} />
        <YAxis tickFormatter={compactINR} width={56} {...axisProps} />
        <Tooltip content={<MoneyTooltip />} labelFormatter={dayLabel} />
        <Line
          type="monotone"
          dataKey={dataKey}
          name="Amount"
          stroke={CHART_COLORS[color]}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CountBarChart({ data, dataKey, color = 3 }: { data: any[]; dataKey: string; color?: number }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} />
        <YAxis allowDecimals={false} width={32} {...axisProps} />
        <Tooltip content={<CountTooltip />} labelFormatter={dayLabel} cursor={{ fill: "hsl(var(--secondary))" }} />
        <Bar dataKey={dataKey} name="Orders" fill={CHART_COLORS[color]} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MoneyBarChart({ data, dataKey, color = 1 }: { data: any[]; dataKey: string; color?: number }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} />
        <YAxis tickFormatter={compactINR} width={56} {...axisProps} />
        <Tooltip content={<MoneyTooltip />} labelFormatter={dayLabel} cursor={{ fill: "hsl(var(--secondary))" }} />
        <Bar dataKey={dataKey} name="Amount" fill={CHART_COLORS[color]} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for leaderboards / category breakdowns. value in paise. */
export function HorizontalMoneyBar({ data, color = 0, isCount = false }: { data: any[]; color?: number; isCount?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={isCount ? undefined : compactINR} {...axisProps} />
        <YAxis type="category" dataKey="name" width={120} {...axisProps} />
        <Tooltip
          content={isCount ? <CountTooltip /> : <MoneyTooltip />}
          cursor={{ fill: "hsl(var(--secondary))" }}
        />
        <Bar dataKey="value" name={isCount ? "Qty" : "Sales"} fill={CHART_COLORS[color]} radius={[0, 4, 4, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<MoneyTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
