/* Contract journeys — feat-handbook-acme-links-auth (AC-AUTH-1..9).
   Cookies are extracted and sent explicitly (deterministic — no reliance on a
   client cookie jar's Secure-on-localhost semantics). */
import { test, expect, type APIResponse } from "@playwright/test";
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://acme:acme@localhost:5433/acme";

let n = 0;
const uniqueEmail = () => `journey-${Date.now()}-${n++}@acme.test`;
const PASSWORD = "hunter2pass";

function setCookies(res: APIResponse): string[] {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
}

/** Cookie header value from a response's Set-Cookie headers. */
function cookieHeader(res: APIResponse): string {
  return setCookies(res)
    .map((c) => c.split(";")[0])
    .filter((c) => !/=\s*$/.test(c)) // drop cleared cookies
    .join("; ");
}

test("AC-AUTH-1: signup creates one user and establishes a session, witnessed by /api/me", async ({
  request,
}) => {
  const email = uniqueEmail();
  const res = await request.post("/signup", {
    data: { email, password: PASSWORD },
  });
  expect(res.status()).toBe(200);

  const me = await request.get("/api/me", {
    headers: { cookie: cookieHeader(res) },
  });
  expect(me.status()).toBe(200);
  const body = (await me.json()) as { user: { email: string } };
  expect(body.user.email).toBe(email);

  const users = await dbQuery(
    `SELECT count(*)::int AS c FROM "user" WHERE email = $1`,
    [email],
  );
  expect(users[0].c).toBe(1);
});

test("AC-AUTH-2: the persisted credential is a one-way hash, never the plaintext", async ({
  request,
}) => {
  const email = uniqueEmail();
  await request.post("/signup", { data: { email, password: PASSWORD } });
  const rows = await dbQuery(
    `SELECT a.password FROM account a JOIN "user" u ON a.user_id = u.id WHERE u.email = $1`,
    [email],
  );
  expect(rows).toHaveLength(1);
  const stored = rows[0].password as string;
  expect(stored).not.toBe(PASSWORD);
  expect(stored).toMatch(/^\$(argon2|2[aby]|scrypt)/);
});

test("AC-AUTH-3: signup with an already-registered email → 409, no additional user", async ({
  request,
}) => {
  const email = uniqueEmail();
  await request.post("/signup", { data: { email, password: PASSWORD } });
  const dup = await request.post("/signup", {
    data: { email, password: "anotherpass9" },
  });
  expect(dup.status()).toBe(409);
  const users = await dbQuery(
    `SELECT count(*)::int AS c FROM "user" WHERE email = $1`,
    [email],
  );
  expect(users[0].c).toBe(1);
});

test("AC-AUTH-4: login with valid credentials → 200 + a session /api/me accepts", async ({
  request,
}) => {
  const email = uniqueEmail();
  await request.post("/signup", { data: { email, password: PASSWORD } });
  const login = await request.post("/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);
  const me = await request.get("/api/me", {
    headers: { cookie: cookieHeader(login) },
  });
  expect(me.status()).toBe(200);
});

test("AC-AUTH-5: invalid credentials → 401, uniform across unknown-user vs wrong-password", async ({
  request,
}) => {
  const email = uniqueEmail();
  await request.post("/signup", { data: { email, password: PASSWORD } });

  const wrongPassword = await request.post("/login", {
    data: { email, password: "wrong-password-1" },
  });
  const unknownUser = await request.post("/login", {
    data: { email: uniqueEmail(), password: "wrong-password-1" },
  });
  expect(wrongPassword.status()).toBe(401);
  expect(unknownUser.status()).toBe(401);
  // No enumeration oracle: byte-identical bodies.
  expect(await wrongPassword.text()).toBe(await unknownUser.text());
  expect(setCookies(wrongPassword).filter((c) => /session/i.test(c))).toHaveLength(0);
});

test("AC-AUTH-6: logout invalidates the session server-side", async ({
  request,
}) => {
  const email = uniqueEmail();
  const signup = await request.post("/signup", {
    data: { email, password: PASSWORD },
  });
  const cookie = cookieHeader(signup);

  const out = await request.post("/logout", { headers: { cookie } });
  expect(out.status()).toBe(200);

  // The PRE-logout session token must now be dead (server-side revocation,
  // not just a cleared cookie).
  const me = await request.get("/api/me", { headers: { cookie } });
  expect(me.status()).toBe(401);
});

test("AC-AUTH-7: /api/me without a session → 401, spoofed middleware-bypass header included (CVE-2025-29927)", async ({
  request,
}) => {
  const bare = await request.get("/api/me");
  expect(bare.status()).toBe(401);

  const spoofed = await request.get("/api/me", {
    headers: {
      "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware",
    },
  });
  expect(spoofed.status()).toBe(401);
});

test("AC-AUTH-8: session cookie is HttpOnly + Secure + SameSite with a bounded TTL, rotated on login", async ({
  request,
}) => {
  const email = uniqueEmail();
  await request.post("/signup", { data: { email, password: PASSWORD } });

  const login1 = await request.post("/login", {
    data: { email, password: PASSWORD },
  });
  const sessionCookie = setCookies(login1).find((c) => /session_token/i.test(c));
  expect(sessionCookie, "login must set a session cookie").toBeTruthy();
  expect(sessionCookie!).toMatch(/HttpOnly/i);
  expect(sessionCookie!).toMatch(/Secure/i);
  expect(sessionCookie!).toMatch(/SameSite=Lax/i);
  const maxAge = /Max-Age=(\d+)/i.exec(sessionCookie!);
  expect(maxAge, "TTL must be bounded").toBeTruthy();
  expect(Number(maxAge![1])).toBeLessThanOrEqual(60 * 60 * 24 * 7);

  const login2 = await request.post("/login", {
    data: { email, password: PASSWORD },
  });
  const second = setCookies(login2).find((c) => /session_token/i.test(c));
  expect(second, "a fresh login rotates the session token").toBeTruthy();
  expect(second!.split(";")[0]).not.toBe(sessionCookie!.split(";")[0]);
});

test("AC-AUTH-9: repeated failed logins are rate-limited with 429", async ({
  request,
}) => {
  const email = uniqueEmail();
  await request.post("/signup", { data: { email, password: PASSWORD } });

  let limited = false;
  for (let i = 0; i < 8; i++) {
    const res = await request.post("/login", {
      data: { email, password: "definitely-wrong" },
    });
    if (res.status() === 429) {
      limited = true;
      break;
    }
    expect(res.status()).toBe(401);
  }
  expect(limited, "the failure threshold must trip a 429").toBe(true);
});

test("SECURITY: a cross-site POST to /login or /signup is refused (login CSRF)", async ({
  request,
}) => {
  // These routes call Better Auth's server API directly, so the origin check
  // its mounted router applies is not in play — the handlers carry it.
  // Without it, evil.com signs a visitor into the ATTACKER's account.
  for (const path of ["/login", "/signup"]) {
    const res = await request.post(path, {
      headers: {
        origin: "https://evil.example",
        "content-type": "application/x-www-form-urlencoded",
      },
      data: "email=attacker@evil.example&password=hunter2pass",
    });
    expect(res.status(), `${path} must refuse a cross-site POST`).toBe(403);
    const cookies = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie");
    expect(cookies, "a refused request must set no session").toHaveLength(0);
  }
});

test("SECURITY: the login limiter is not defeated by a spoofed x-forwarded-for", async ({
  request,
}) => {
  const email = uniqueEmail();
  await request.post("/signup", { data: { email, password: PASSWORD } });

  let limited = false;
  for (let i = 0; i < 8; i++) {
    const res = await request.post("/login", {
      // A client-supplied XFF must not mint a fresh bucket per attempt.
      headers: { "x-forwarded-for": `203.0.113.${i}` },
      data: { email, password: "definitely-wrong" },
    });
    if (res.status() === 429) {
      limited = true;
      break;
    }
  }
  expect(limited, "rotating x-forwarded-for must not buy extra guesses").toBe(
    true,
  );
});

async function dbQuery(
  sql: string,
  params: unknown[],
): Promise<Array<Record<string, unknown>>> {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query(sql, params);
    return rows;
  } finally {
    await db.end();
  }
}
