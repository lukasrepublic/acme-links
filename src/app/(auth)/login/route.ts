// POST /login — establish a session (AC-AUTH-4, -5, -9). GET /login — the form.
import { auth } from "@/lib/auth";
import { jsonWithCookies, readCredentials } from "@/lib/auth/http";
import {
  clientKey,
  isRateLimited,
  recordFailure,
} from "@/lib/auth/rate-limit";

// AC-AUTH-5: one uniform body for every credential failure — no oracle for
// "no such account" vs "wrong password".
const INVALID = { error: "invalid email or password" };

export async function GET(req: Request) {
  return Response.redirect(new URL("/login/form", req.url), 307);
}

export async function POST(req: Request) {
  const creds = await readCredentials(req);
  if (!creds) return jsonWithCookies(INVALID, 401);
  const key = clientKey(req, creds.email);
  if (isRateLimited(key)) {
    return jsonWithCookies({ error: "too many attempts, try again later" }, 429);
  }
  // asResponse: failures come back AS the Response (nothing is thrown).
  const res = await auth.api.signInEmail({
    body: { email: creds.email, password: creds.password },
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
  recordFailure(key);
  return jsonWithCookies(INVALID, 401);
}
