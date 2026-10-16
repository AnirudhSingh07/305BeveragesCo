"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/money";
import { formatIst, businessDate, istDayStartUtc } from "@/lib/datetime";
import type { ExpenseRow } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { Plus, Search, Pencil, Trash2, Loader2, Download } from "lucide-react";

interface Cat { id: string; name: string }
const r2p = (v: string) => Math.round((parseFloat(v) || 0) * 100);

/** Convert an IST calendar date (yyyy-MM-dd) to a mid-day UTC instant so it
 *  always falls on the intended business date regardless of server tz. */
function istDateToUtc(dateStr: string): string {
  return new Date(istDayStartUtc(dateStr).getTime() + 12 * 3600 * 1000).toISOString();
}

const empty = {
  title: "", amount: "", category_id: "", payment_method: "cash",
  vendor: "", description: "", receipt_url: "", date: "",
  is_recurring: false, recurrence: "monthly",
};

export function ExpensesClient({
  expenses,
  categories,
  exportQs,
  businessId,
}: {
  expenses: ExpenseRow[];
  categories: Cat[];
  exportQs: string;
  businessId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty, date: businessDate() });
  const [confirmDelete, setConfirmDelete] = useState<ExpenseRow | null>(null);

  const visible = expenses.filter((e) => {
    if (filterCat !== "all" && e.category_name !== filterCat) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${e.title} ${e.vendor ?? ""} ${e.description ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  function openAdd() {
    setForm({ ...empty, category_id: categories[0]?.id ?? "", date: businessDate() });
    setEditingId(null);
    setDialogOpen(true);
  }
  function openEdit(e: ExpenseRow) {
    const cat = categories.find((c) => c.name === e.category_name);
    setForm({
      title: e.title,
      amount: (e.amount / 100).toString(),
      category_id: cat?.id ?? "",
      payment_method: e.payment_method,
      vendor: e.vendor ?? "",
      description: e.description ?? "",
      receipt_url: e.receipt_url ?? "",
      date: businessDate(new Date(e.incurred_at)),
      is_recurring: e.is_recurring,
      recurrence: e.recurrence ?? "monthly",
    });
    setEditingId(e.id);
    setDialogOpen(true);
  }

  async function save() {
    if (!form.title.trim()) return toast("Title is required", "error");
    setBusy(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        amount: r2p(form.amount),
        category_id: form.category_id || null,
        category_name: categories.find((c) => c.id === form.category_id)?.name ?? null,
        payment_method: form.payment_method,
        vendor: form.vendor.trim() || null,
        description: form.description.trim() || null,
        receipt_url: form.receipt_url.trim() || null,
        incurred_at: istDateToUtc(form.date),
        is_recurring: form.is_recurring,
        recurrence: form.is_recurring ? form.recurrence : null,
      };
      if (editingId) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
        if (error) throw error;
        toast("Expense updated", "success");
      } else {
        const { error } = await supabase.from("expenses").insert({ ...payload, business_id: businessId });
        if (error) throw error;
        toast("Expense recorded", "success");
      }
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err, "Save failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      // Soft delete keeps an audit trail.
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", confirmDelete.id);
      if (error) throw error;
      toast("Expense deleted", "success");
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err, "Delete failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search expenses…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <a href={`/api/export/expenses?${exportQs}`}>
          <Button variant="outline"><Download className="h-4 w-4" /> Export</Button>
        </a>
        <Button variant="accent" onClick={openAdd}><Plus className="h-4 w-4" /> Add expense</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No expenses in this period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.title}
                      {e.is_recurring && <Badge variant="accent" className="ml-2">{e.recurrence}</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.category_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatIst(e.incurred_at, "dd MMM yyyy")}</TableCell>
                    <TableCell className="uppercase text-muted-foreground">{e.payment_method}</TableCell>
                    <TableCell className="text-muted-foreground">{e.vendor ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tnum">{formatINR(e.amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(e)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit expense" : "Add expense"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Vendor / recipient (optional)</Label>
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Receipt / invoice URL (optional)</Label>
              <Input value={form.receipt_url} onChange={(e) => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
              Recurring expense
            </label>
            {form.is_recurring && (
              <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="accent" disabled={busy} onClick={save}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete “{confirmDelete?.title}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes it from reports. The record is soft-deleted and retained for audit.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={del}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
