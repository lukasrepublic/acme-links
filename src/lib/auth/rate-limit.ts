// AC-AUTH-9: brute-force guard for the credential surfaces. Better Auth's
// built-in limiter guards its own mounted handler, not server-side API calls,
// so the routes that own /login and /signup enforce this themselves.
//
// In-memory, per process — honest for a single-instance app; a multi-instance
// deployment would back this with a shared store.

const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

/** Key a client by network origin + attempted identity. */
export function clientKey(req: Request, email: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${ip}:${email.trim().toLowerCase()}`;
}

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, recent);
  return recent.length >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  failures.set(key, recent);
}
