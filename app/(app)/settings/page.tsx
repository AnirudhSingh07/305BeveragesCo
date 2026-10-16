import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: biz }, { data: profile }] = await Promise.all([
    supabase.from("businesses").select("*").limit(1).maybeSingle(),
    supabase.from("profiles").select("role, full_name").eq("id", user?.id ?? "").maybeSingle(),
  ]);

  return (
    <div>
      <PageHeader title="Settings" description="Business profile and receipt configuration." />
      <SettingsClient
        business={biz as any}
        email={user?.email ?? ""}
        role={profile?.role ?? "owner"}
      />
    </div>
  );
}
