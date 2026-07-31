// AC-AUTH-9: brute-force guard for the credential surfaces. Better Auth's
// built-in limiter guards its own mounted handler, not server-side API calls,
// so the routes that own /login and /signup enforce this themselves.
//
// In-memory, per process — honest for a single-instance app; a multi-instance
// deployment would back this with a shared store.
//
// THE KEY DELIBERATELY DOES NOT TRUST x-forwarded-for. A client can set that
// header to anything, so keying on it hands an attacker an unlimited number of
// guesses — a limiter that a single header defeats is worse than none, because
// it reads as protection. XFF is used only when the deployment declares a
// trusted proxy that overwrites it (TRUST_PROXY=1).

const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;
// Bound the map: a limiter that grows per distinct key is itself a memory DoS.
const MAX_TRACKED_KEYS = 10_000;

const failures = new Map<string, number[]>();

/** Key a client by attempted identity (+ network origin, only behind a
 *  trusted proxy). */
export function clientKey(req: Request, email: string): string {
  const identity = email.trim().toLowerCase();
  if (process.env.TRUST_PROXY === "1") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    return `${ip}:${identity}`;
  }
  return identity;
}

function recentFailures(key: string): number[] {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  // Never retain an empty bucket — that is what made the map unbounded.
  if (recent.length === 0) failures.delete(key);
  else failures.set(key, recent);
  return recent;
}

/** Credential surfaces use the default; other surfaces pass their own bound
 *  (a link-creation cap and a password-guess cap are not the same number). */
export function isRateLimited(key: string, max: number = MAX_FAILURES): boolean {
  return recentFailures(key).length >= max;
}

/** Record one countable event against a key (a credential failure, or a
 *  successful creation — the caller decides what its bound counts). */
export function recordEvent(key: string): void {
  const recent = recentFailures(key);
  if (!failures.has(key) && failures.size >= MAX_TRACKED_KEYS) {
    // Shed the oldest tracked key rather than growing without bound.
    const oldest = failures.keys().next().value;
    if (oldest !== undefined) failures.delete(oldest);
  }
  recent.push(Date.now());
  failures.set(key, recent);
}
