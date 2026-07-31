// POST /signup — create an account + establish a session (AC-AUTH-1..3, -9).
// GET /signup — send browsers to the form.
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

function appBase(): string {
  // Configuration, never the request's Host header (see /login).
  return process.env.BASE_URL ?? "http://localhost:3000";
}

export async function GET() {
  return Response.redirect(new URL("/signup/form", appBase()), 307);
}

export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) {
    return jsonWithCookies({ error: "cross-site request refused" }, 403);
  }
  if (bodyTooLarge(req)) {
    return jsonWithCookies({ error: "request body too large" }, 413);
  }
  const creds = await readCredentials(req);
  if (!creds) {
    return jsonWithCookies({ error: "email and password are required" }, 400);
  }
  const key = clientKey(req, creds.email);
  if (isRateLimited(key)) {
    return jsonWithCookies({ error: "too many attempts, try again later" }, 429);
  }
  // asResponse: failures come back AS the Response (nothing is thrown).
  const res = await auth.api.signUpEmail({
    body: {
      name: creds.email.split("@")[0],
      email: creds.email,
      password: creds.password,
    },
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
  recordEvent(key);
  if (res.status === 422) {
    // AC-AUTH-3: duplicate email — conflict, no additional user.
    return jsonWithCookies({ error: "account already exists" }, 409);
  }
  if (res.status < 500) {
    return jsonWithCookies({ error: "invalid signup" }, res.status);
  }
  return jsonWithCookies({ error: "signup failed" }, 500);
}
