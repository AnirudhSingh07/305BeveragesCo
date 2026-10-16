/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * Supabase / PostgREST errors are plain objects ({ message, details, hint,
 * code }) — NOT Error instances — so a bare `err instanceof Error` check misses
 * them and callers fall back to a generic string. This helper digs the real
 * message out so failures are actually diagnosable.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string") return err || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    for (const key of ["message", "error_description", "error", "details", "hint"]) {
      const v = e[key];
      if (typeof v === "string" && v) return v;
    }
  }
  return fallback;
}
