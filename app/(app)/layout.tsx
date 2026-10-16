import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { GlassWater } from "lucide-react";

export const dynamic = "force-dynamic";

function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-lg rounded-xl border bg-card p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <GlassWater className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Connect Supabase to continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The app code is complete, but it needs a Supabase project. Copy{" "}
          <code>.env.example</code> to <code>.env.local</code>, add your project URL
          and anon key, run the SQL migrations in <code>supabase/migrations</code>,
          then restart the dev server. Full steps are in the README.
        </p>
      </div>
    </div>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) return <SetupNeeded />;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Idempotently ensure this owner has a seeded business.
  const { data: biz } = await supabase.rpc("ensure_business", {
    p_name: "305 Beverages Co.",
  });
  const businessName =
    (Array.isArray(biz) ? biz[0]?.name : (biz as { name?: string })?.name) ??
    "305 Beverages Co.";

  return (
    <div className="min-h-screen">
      <AppSidebar businessName={businessName} />
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
