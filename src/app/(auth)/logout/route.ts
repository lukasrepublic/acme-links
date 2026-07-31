// POST /logout — invalidate the session server-side (AC-AUTH-6).
import { auth } from "@/lib/auth";
import { jsonWithCookies } from "@/lib/auth/http";

export async function POST(req: Request) {
  try {
    const res = await auth.api.signOut({
      headers: req.headers,
      asResponse: true,
    });
    return jsonWithCookies({ ok: true }, 200, res);
  } catch {
    // No live session to revoke — logging out is still a success.
    return jsonWithCookies({ ok: true }, 200);
  }
}
