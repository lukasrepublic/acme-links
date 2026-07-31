// POST /logout — invalidate the session server-side (AC-AUTH-6).
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { isCrossSiteRequest, jsonWithCookies } from "@/lib/auth/http";

export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) {
    return jsonWithCookies({ error: "cross-site request refused" }, 403);
  }
  try {
    const res = await auth.api.signOut({
      headers: req.headers,
      asResponse: true,
    });
    return jsonWithCookies({ ok: true }, 200, res);
  } catch (err) {
    // No live session to revoke — logging out is still a success. Anything
    // else (a DB outage, an adapter error) must NOT report success: the
    // session is still live server-side and the user would believe otherwise.
    if (err instanceof APIError && err.statusCode === 401) {
      return jsonWithCookies({ ok: true }, 200);
    }
    return jsonWithCookies({ error: "logout failed" }, 500);
  }
}
