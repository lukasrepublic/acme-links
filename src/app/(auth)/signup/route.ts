// POST /signup — create an account + establish a session (AC-AUTH-1..3, -9).
// GET /signup — send browsers to the form.
import { auth } from "@/lib/auth";
import { jsonWithCookies, readCredentials } from "@/lib/auth/http";
import {
  clientKey,
  isRateLimited,
  recordFailure,
} from "@/lib/auth/rate-limit";

export async function GET(req: Request) {
  return Response.redirect(new URL("/signup/form", req.url), 307);
}

export async function POST(req: Request) {
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
    body: { name: creds.email, email: creds.email, password: creds.password },
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
  recordFailure(key);
  if (res.status === 422) {
    // AC-AUTH-3: duplicate email — conflict, no additional user.
    return jsonWithCookies({ error: "account already exists" }, 409);
  }
  if (res.status < 500) {
    return jsonWithCookies({ error: "invalid signup" }, res.status);
  }
  return jsonWithCookies({ error: "signup failed" }, 500);
}
