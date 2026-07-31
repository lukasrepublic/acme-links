// Shared plumbing for the auth route handlers.

/** Accept JSON or form-encoded bodies (the tutorial drives these with curl). */
export async function readCredentials(
  req: Request,
): Promise<{ email: string; password: string } | null> {
  const text = await req.text();
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
