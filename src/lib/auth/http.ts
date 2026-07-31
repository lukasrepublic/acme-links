// Shared plumbing for the auth route handlers.

/** The one origin this app answers state-changing requests for. */
function appOrigin(): string {
  return new URL(process.env.BASE_URL ?? "http://localhost:3000").origin;
}

/** Cross-site POST guard. These routes call Better Auth's server API directly,
 *  which bypasses the origin check its mounted router would have applied — so
 *  the check lives here. Without it, evil.com can auto-submit a form-encoded
 *  POST /login with the ATTACKER's credentials (a "simple request", so no
 *  preflight and no victim cookie needed) and silently sign the visitor into
 *  the attacker's account: login CSRF, which SameSite=Lax does not stop.
 *  A same-origin browser request matches; curl (no Origin) is allowed. */
export function isCrossSiteRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return true;
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== appOrigin()) return true;
  return false;
}

/** Credential bodies are small; anything larger is refused before it is read
 *  (an unbounded req.text() on an unauthenticated route is a memory DoS). */
const MAX_BODY_BYTES = 8 * 1024;

export function bodyTooLarge(req: Request): boolean {
  const declared = Number(req.headers.get("content-length") ?? "0");
  return !Number.isFinite(declared) || declared > MAX_BODY_BYTES;
}

/** Accept JSON or form-encoded bodies (the tutorial drives these with curl). */
export async function readCredentials(
  req: Request,
): Promise<{ email: string; password: string } | null> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return null;
  let email = "";
  let password = "";
  try {
    const parsed = JSON.parse(text);
    email = typeof parsed.email === "string" ? parsed.email : "";
    password = typeof parsed.password === "string" ? parsed.password : "";
  } catch {
    const form = new URLSearchParams(text);
    email = form.get("email") ?? "";
    password = form.get("password") ?? "";
  }
  if (!email || !password) return null;
  return { email, password };
}

/** Our JSON body + the Set-Cookie headers Better Auth produced. */
export function jsonWithCookies(
  payload: unknown,
  status: number,
  from?: Response,
): Response {
  const res = new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  if (from) {
    for (const cookie of from.headers.getSetCookie()) {
      res.headers.append("Set-Cookie", cookie);
    }
  }
  return res;
}
