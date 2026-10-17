"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export function OrdersFilters({ categories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function set(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value && value !== "all") sp.set(key, value);
    else sp.delete(key);
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", isPending && "opacity-60")}>
      <div className="relative min-w-[220px] flex-1">
        {isPending ? (
          <Spinner className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          defaultValue={params.get("q") ?? ""}
          placeholder="Search order no. or product…"
          className="pl-9"
          onChange={(e) => set("q", e.target.value)}
        />
      </div>
      <DateRangePicker />
      <Select value={params.get("category") ?? "all"} onValueChange={(v) => set("category", v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={params.get("method") ?? "all"} onValueChange={(v) => set("method", v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Payment" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All payments</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="upi">UPI</SelectItem>
          <SelectItem value="card">Card</SelectItem>
          <SelectItem value="split">Cash + Online</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
      <Select value={params.get("pstatus") ?? "all"} onValueChange={(v) => set("pstatus", v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Pay status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All pay status</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="unpaid">Unpaid</SelectItem>
        </SelectContent>
      </Select>
      <Select value={params.get("ostatus") ?? "all"} onValueChange={(v) => set("ostatus", v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Order status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All orders</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={params.get("sort") ?? "newest"} onValueChange={(v) => set("sort", v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="oldest">Oldest first</SelectItem>
          <SelectItem value="high">Highest amount</SelectItem>
          <SelectItem value="low">Lowest amount</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
