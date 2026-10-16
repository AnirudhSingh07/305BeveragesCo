"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import type { DateRangePreset } from "@/lib/datetime";

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const preset = (params.get("range") as DateRangePreset) || "today";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  function update(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", isPending && "opacity-60")}>
      <Select value={preset} onValueChange={(v) => update({ range: v })}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {preset === "custom" && (
        <>
          <Input
            type="date"
            value={from}
            className="w-[150px]"
            onChange={(e) => update({ range: "custom", from: e.target.value })}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={to}
            className="w-[150px]"
            onChange={(e) => update({ range: "custom", to: e.target.value })}
          />
        </>
      )}
      {isPending && <Spinner className="text-muted-foreground" />}
    </div>
  );
}
