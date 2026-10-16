"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Plus, Search, Pencil, Trash2, Loader2, Download, Tags } from "lucide-react";

interface Category { id: string; name: string; subgroup: string | null; sort_order: number }
interface Product {
  id: string; category_id: string; name: string;
  price_paise: number; cost_paise: number | null; is_available: boolean; popularity: number;
}

const r2p = (v: string) => Math.round((parseFloat(v) || 0) * 100);
const p2r = (v: number | null) => (v == null ? "" : (v / 100).toString());

export function MenuClient({ categories, products }: { categories: Category[]; products: Product[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", category_id: categories[0]?.id ?? "", price: "", cost: "", available: true });
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const [catDialog, setCatDialog] = useState(false);
  const [catEditing, setCatEditing] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", subgroup: "" });

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const visible = products
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "price") return a.price_paise - b.price_paise;
      if (sort === "category") return catName(a.category_id).localeCompare(catName(b.category_id));
      if (sort === "popularity") return b.popularity - a.popularity;
      return a.name.localeCompare(b.name);
    });

  function openAdd() {
    setForm({ name: "", category_id: categories[0]?.id ?? "", price: "", cost: "", available: true });
    setAdding(true);
  }
  function openEdit(p: Product) {
    setForm({ name: p.name, category_id: p.category_id, price: p2r(p.price_paise), cost: p2r(p.cost_paise), available: p.is_available });
    setEditing(p);
  }

  async function saveProduct() {
    if (!form.name.trim()) return toast("Name is required", "error");
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        category_id: form.category_id,
        price_paise: r2p(form.price),
        cost_paise: form.cost.trim() === "" ? null : r2p(form.cost),
        is_available: form.available,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast("Product updated", "success");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast("Product added", "success");
      }
      setEditing(null);
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailable(p: Product) {
    const { error } = await supabase.from("products").update({ is_available: !p.is_available }).eq("id", p.id);
    if (error) return toast(error.message, "error");
    toast(p.is_available ? "Marked unavailable" : "Marked available", "success");
    router.refresh();
  }

  async function deleteProduct() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      // order_items.product_id is ON DELETE SET NULL, so historical snapshots survive.
      const { error } = await supabase.from("products").delete().eq("id", confirmDelete.id);
      if (error) throw error;
      toast("Product deleted (sales history preserved)", "success");
      setConfirmDelete(null);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory() {
    if (!catForm.name.trim()) return toast("Category name required", "error");
    setBusy(true);
    try {
      const payload = { name: catForm.name.trim(), subgroup: catForm.subgroup.trim() || null };
      if (catEditing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", catEditing.id);
        if (error) throw error;
      } else {
        const nextSort = Math.max(0, ...categories.map((c) => c.sort_order)) + 1;
        const { error } = await supabase.from("categories").insert({ ...payload, sort_order: nextSort });
        if (error) throw error;
      }
      toast("Category saved", "success");
      setCatDialog(false);
      setCatEditing(null);
      setCatForm({ name: "", subgroup: "" });
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Menu Management" description="Products, prices, costs, and categories.">
        <a href="/api/export/menu"><Button variant="outline"><Download className="h-4 w-4" /> Export</Button></a>
        <Button variant="outline" onClick={() => { setCatEditing(null); setCatForm({ name: "", subgroup: "" }); setCatDialog(true); }}>
          <Tags className="h-4 w-4" /> Categories
        </Button>
        <Button variant="accent" onClick={openAdd}><Plus className="h-4 w-4" /> Add product</Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="popularity">Popularity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{catName(p.category_id)}</TableCell>
                  <TableCell className="text-right tnum">{formatINR(p.price_paise)}</TableCell>
                  <TableCell className="text-right tnum">
                    {p.cost_paise == null ? (
                      <Badge variant="warning">No cost</Badge>
                    ) : (
                      formatINR(p.cost_paise)
                    )}
                  </TableCell>
                  <TableCell className="text-right tnum text-muted-foreground">{p.popularity}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleAvailable(p)}>
                      <Badge variant={p.is_available ? "success" : "outline"}>
                        {p.is_available ? "Available" : "Unavailable"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit product */}
      <Dialog open={adding || !!editing} onOpenChange={(o) => { if (!o) { setAdding(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Selling price (₹)</Label>
                <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit cost (₹)</Label>
                <Input type="number" min={0} placeholder="optional" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
              Available for sale
            </label>
          </div>
          <DialogFooter>
            <Button variant="accent" disabled={busy} onClick={saveProduct}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete “{confirmDelete?.name}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Past sales keep their price and name snapshots, so historical reports are unaffected.
            To simply hide it from the POS, mark it unavailable instead.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={deleteProduct}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category manager */}
      <Dialog open={catDialog} onOpenChange={(o) => { if (!o) { setCatDialog(false); setCatEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Categories</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCatEditing(c); setCatForm({ name: c.name, subgroup: c.subgroup ?? "" }); }}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-secondary"
              >
                <span>{c.name}{c.subgroup && <span className="ml-2 text-xs text-muted-foreground">/ {c.subgroup}</span>}</span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="space-y-3 border-t pt-3">
            <div className="text-sm font-medium">{catEditing ? `Edit “${catEditing.name}”` : "Add category"}</div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              <Input placeholder="Subgroup (optional)" value={catForm.subgroup} onChange={(e) => setCatForm({ ...catForm, subgroup: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            {catEditing && (
              <Button variant="outline" onClick={() => { setCatEditing(null); setCatForm({ name: "", subgroup: "" }); }}>
                New instead
              </Button>
            )}
            <Button variant="accent" disabled={busy} onClick={saveCategory}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
