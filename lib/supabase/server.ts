import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isConfigured } from "./config";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads/writes the auth session via Next.js cookies. Uses the anon key — all
 * access is still constrained by Row Level Security.
 */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only;
            // the middleware refreshes the session instead.
          }
        },
      },
    }
  );
}

/** True when real Supabase env vars are configured (used to show setup guidance). */
export function isSupabaseConfigured(): boolean {
  return isConfigured(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
