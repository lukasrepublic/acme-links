// POST /login — establish a session (AC-AUTH-4, -5, -9). GET /login — the form.
import { auth } from "@/lib/auth";
import {
  bodyTooLarge,
  isCrossSiteRequest,
  jsonWithCookies,
  readCredentials,
} from "@/lib/auth/http";
import {
  clientKey,
  isRateLimited,
  recordEvent,
} from "@/lib/auth/rate-limit";

// AC-AUTH-5: one uniform body for every credential failure — no oracle for
// "no such account" vs "wrong password".
const INVALID = { error: "invalid email or password" };

export async function GET() {
  return Response.redirect(new URL("/login/form", appBase()), 307);
}

function appBase(): string {
  // Built from configuration, never from the request's Host header — a
  // spoofed Host would otherwise redirect visitors to an attacker's origin.
  return process.env.BASE_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) {
    return jsonWithCookies({ error: "cross-site request refused" }, 403);
  }
  if (bodyTooLarge(req)) {
    return jsonWithCookies({ error: "request body too large" }, 413);
  }
  const creds = await readCredentials(req);
  if (!creds) return jsonWithCookies(INVALID, 401);
  const key = clientKey(req, creds.email);
  if (isRateLimited(key)) {
    return jsonWithCookies({ error: "too many attempts, try again later" }, 429);
  }
  // asResponse: failures come back AS the Response (nothing is thrown).
  const res = await auth.api.signInEmail({
    body: { email: creds.email, password: creds.password },
    headers: req.headers,
    asResponse: true,
  });
  if (res.ok) {
    const body = (await res.json()) as { user?: { id: string; email: string } };
    return jsonWithCookies(
      { user: body.user ? { id: body.user.id, email: body.user.email } : null },
      200,
      res,
    );
  }
  if (res.status >= 500) {
    return jsonWithCookies({ error: "login failed" }, 500);
  }
  // AC-AUTH-5: every credential failure is the same 401 — no oracle.
  recordEvent(key);
  return jsonWithCookies(INVALID, 401);
}
