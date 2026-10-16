/**
 * Duplicate-submission prevention. The POS generates a stable client token per
 * cart "attempt"; create_order is idempotent on (business_id, client_token) at
 * the database level, and this client guard blocks a second concurrent submit
 * while one is in flight.
 */
export function newClientToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A tiny single-flight gate. Returns false if a submit is already running. */
export function createSubmissionGuard() {
  let inFlight = false;
  return {
    get busy() {
      return inFlight;
    },
    /** Returns true if the caller acquired the lock; false if already busy. */
    acquire(): boolean {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    release() {
      inFlight = false;
    },
  };
}
