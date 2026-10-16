import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — BYPASSES RLS. Server-only (the `server-only` import
 * makes it a build error to import this from client code). Use strictly for
 * trusted admin/seed scripts, never in response to untrusted user input.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
