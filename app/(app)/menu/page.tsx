import { createClient } from "@/lib/supabase/server";
import { MenuClient } from "./menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: products }, { data: items }, { data: biz }] =
    await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").order("name"),
      supabase.from("order_items").select("product_id, quantity"),
      supabase.from("businesses").select("id").limit(1).maybeSingle(),
    ]);

  const popularity = new Map<string, number>();
  for (const it of items ?? []) {
    if (!it.product_id) continue;
    popularity.set(it.product_id, (popularity.get(it.product_id) ?? 0) + it.quantity);
  }

  const productsWithPop = (products ?? []).map((p: any) => ({
    ...p,
    popularity: popularity.get(p.id) ?? 0,
  }));

  return (
    <MenuClient
      categories={(categories ?? []) as any}
      products={productsWithPop as any}
      businessId={biz?.id ?? ""}
    />
  );
}
