/**
 * Client-safe check for whether real Supabase credentials are present.
 * Rejects empty values AND the placeholder text shipped in .env examples, so a
 * half-filled env never makes the app try to reach a fake project (which would
 * hang requests). Used by both the server client and the login screen.
 */
export function isConfigured(url?: string | null, key?: string | null): boolean {
  if (!url || !key) return false;
  if (url.includes("YOUR-PROJECT-REF") || key.startsWith("PASTE-")) return false;
  if (!/^https:\/\/.+\.supabase\.co/.test(url)) return false;
  return key.length > 20;
}
