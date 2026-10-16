"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { CalendarCheck, Printer, Loader2, Download } from "lucide-react";

export function ClosingActions({
  date,
  snapshot,
  businessDate,
}: {
  date: string;
  snapshot: Record<string, unknown>;
  businessDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);

  function setDate(v: string) {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set("date", v);
    else sp.delete("date");
    router.push(`${pathname}?${sp.toString()}`);
  }

  async function generate() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("record_daily_closing", {
        p_date: date,
        p_snapshot: snapshot,
      });
      if (error) throw error;
      toast(`Daily closing recorded for ${date}`, "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to record closing", "error");
    } finally {
      setBusy(false);
    }
  }

  const qs = `date=${date}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={date}
        max={businessDate}
        className="w-[160px]"
        onChange={(e) => setDate(e.target.value)}
      />
      <a href={`/api/export/daily-summary?range=custom&from=${date}&to=${date}`}>
        <Button variant="outline"><Download className="h-4 w-4" /> CSV</Button>
      </a>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print
      </Button>
      <Button variant="accent" disabled={busy} onClick={generate}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
        Generate report
      </Button>
    </div>
  );
}
