// GET /api/me — the auth-required probe surface (AC-AUTH-1, -6, -7).
// Session enforcement lives HERE, in the route handler — never middleware-only
// (CVE-2025-29927: a spoofed x-middleware-subrequest header must change nothing).
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { id, email, name } = session.user;
  return Response.json({ user: { id, email, name } });
}
