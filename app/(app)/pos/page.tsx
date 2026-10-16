import { createClient } from "@/lib/supabase/server";
import { PosClient } from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: products }, { data: biz }] =
    await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase
        .from("products")
        .select("id, category_id, name, price_paise, cost_paise, is_available")
        .eq("is_available", true)
        .order("name"),
      supabase
        .from("businesses")
        .select("name, receipt_header, receipt_footer")
        .limit(1)
        .maybeSingle(),
    ]);

  return (
    <PosClient
      categories={(categories ?? []) as any}
      products={(products ?? []) as any}
      businessName={biz?.name ?? "305 Beverages Co."}
      receiptHeader={biz?.receipt_header ?? null}
      receiptFooter={biz?.receipt_footer ?? null}
    />
  );
}
