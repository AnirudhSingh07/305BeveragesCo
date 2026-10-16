import type { OrderRow } from "./queries";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Apply the Orders-page filters + sort. Shared by the page and CSV export. */
export function applyOrderFilters(orders: OrderRow[], sp: SP): OrderRow[] {
  const q = (one(sp.q) ?? "").trim().toLowerCase();
  const category = one(sp.category);
  const method = one(sp.method);
  const pstatus = one(sp.pstatus);
  const ostatus = one(sp.ostatus);
  const sort = one(sp.sort) ?? "newest";

  let out = orders.filter((o) => {
    if (method && method !== "all" && o.payment_method !== method) return false;
    if (pstatus && pstatus !== "all" && o.payment_status !== pstatus) return false;
    if (ostatus && ostatus !== "all" && o.status !== ostatus) return false;
    if (category && category !== "all" && !o.itemsDetailed.some((i) => i.category_name === category))
      return false;
    if (q) {
      const inNumber = o.order_number.toLowerCase().includes(q);
      const inProduct = o.itemsDetailed.some((i) => i.product_name.toLowerCase().includes(q));
      if (!inNumber && !inProduct) return false;
    }
    return true;
  });

  out = [...out].sort((a, b) => {
    if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
    if (sort === "high") return b.net_amount - a.net_amount;
    if (sort === "low") return a.net_amount - b.net_amount;
    return b.created_at.localeCompare(a.created_at);
  });
  return out;
}
