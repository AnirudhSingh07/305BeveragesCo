"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";

interface Business {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  receipt_header: string | null;
  receipt_footer: string | null;
}

export function SettingsClient({
  business,
  email,
  role,
}: {
  business: Business;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(business?.name ?? "");
  const [header, setHeader] = useState(business?.receipt_header ?? "");
  const [footer, setFooter] = useState(business?.receipt_footer ?? "");

  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          name: name.trim() || "305 Beverages Co.",
          receipt_header: header.trim() || null,
          receipt_footer: footer.trim() || null,
        })
        .eq("id", business.id);
      if (error) throw error;
      toast("Settings saved", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>Shown across the app and on receipts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Business name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={business?.currency ?? "INR"} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input value={business?.timezone ?? "Asia/Kolkata"} disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Currency is fixed to Indian Rupees (₹) and the business timezone to Asia/Kolkata
            for this release.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt settings</CardTitle>
          <CardDescription>Optional header &amp; footer printed on receipts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Receipt header</Label>
            <Textarea value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Address, GSTIN, phone…" />
          </div>
          <div className="space-y-1.5">
            <Label>Receipt footer</Label>
            <Textarea value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Thank you! Visit again." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Signed in as</span>
            <span className="font-medium">{email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="accent" className="capitalize">{role}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Button variant="accent" disabled={busy} onClick={save}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </Button>
      </div>
    </div>
  );
}
