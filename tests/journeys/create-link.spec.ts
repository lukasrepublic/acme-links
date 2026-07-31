/* Contract journeys — feat-handbook-acme-links-create-link (AC-CREATE-1..7). */
import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://acme:acme@localhost:5433/acme";
const PASSWORD = "hunter2pass";

let n = 0;
const uniqueEmail = () => `links-${Date.now()}-${n++}@acme.test`;

function cookieHeader(res: APIResponse): string {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0])
    .filter((c) => !/=\s*$/.test(c))
    .join("; ");
}

async function signupCookie(request: APIRequestContext): Promise<string> {
  const res = await request.post("/signup", {
    data: { email: uniqueEmail(), password: PASSWORD },
  });
  expect(res.status()).toBe(200);
  return cookieHeader(res);
}

async function countLinks(): Promise<number> {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query(`SELECT count(*)::int AS c FROM link`);
    return rows[0].c as number;
  } finally {
    await db.end();
  }
}

test("AC-CREATE-1: authed POST /api/links with a valid https url → 201 {slug, shortUrl}", async ({
  request,
}) => {
  const cookie = await signupCookie(request);
  const res = await request.post("/api/links", {
    headers: { cookie },
    data: { url: "https://example.com/some/long/path?with=query" },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { slug: string; shortUrl: string };
  expect(body.slug).toMatch(/^[A-Za-z0-9]{7}$/);
  expect(body.shortUrl).toBe(`http://localhost:3000/r/${body.slug}`);
});

test("AC-CREATE-2: anonymous POST /api/links → 401 and creates no link", async ({
  request,
}) => {
  const before = await countLinks();
  const res = await request.post("/api/links", {
    data: { url: "https://example.com/x" },
  });
  expect(res.status()).toBe(401);
  expect(await countLinks()).toBe(before);
});

test("AC-CREATE-3: non-http(s) after normalization → 400 and creates no link", async ({
  request,
}) => {
  const cookie = await signupCookie(request);
  const before = await countLinks();
  const bad = [
    " Javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "mailto:x@example.com",
    "//example.com/protocol-relative",
    "not a url at all",
    "",
  ];
  for (const url of bad) {
    const res = await request.post("/api/links", {
      headers: { cookie },
      data: { url },
    });
    expect(res.status(), `${JSON.stringify(url)} must be refused`).toBe(400);
  }
  expect(await countLinks()).toBe(before);
});

test("AC-CREATE-4: url longer than 2048 characters → 400 and creates no link", async ({
  request,
}) => {
  const cookie = await signupCookie(request);
  const before = await countLinks();
  const res = await request.post("/api/links", {
    headers: { cookie },
    data: { url: "https://example.com/" + "a".repeat(2048) },
  });
  expect(res.status()).toBe(400);
  expect(await countLinks()).toBe(before);
});

test("AC-CREATE-5 + AC-CREATE-6: 100 created slugs are pairwise-distinct 7-char base62", async ({
  request,
}) => {
  const cookie = await signupCookie(request);
  const slugs = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const res = await request.post("/api/links", {
      headers: { cookie },
      data: { url: `https://example.com/bulk/${i}` },
    });
    expect(res.status()).toBe(201);
    const { slug } = (await res.json()) as { slug: string };
    expect(slug).toMatch(/^[A-Za-z0-9]{7}$/);
    slugs.add(slug);
  }
  expect(slugs.size).toBe(100);
  // Not a sequential/predictable source: adjacent slugs must not be
  // lexicographic neighbors marching in one direction.
  const list = [...slugs];
  const ascending = list.every((s, i) => i === 0 || list[i - 1] < s);
  const descending = list.every((s, i) => i === 0 || list[i - 1] > s);
  expect(ascending || descending).toBe(false);
});

test("SECURITY: what is validated is what is stored — the canonical URL, not the raw input", async ({
  request,
}) => {
  const cookie = await signupCookie(request);
  // U+010A / U+010D are CR/LF with a high byte attached: URL() accepts them
  // and would percent-encode them, but the RAW string keeps them — and the
  // raw string is what used to reach the Location header.
  const raw = "https://example.com/x#čĊX-Injected:1";
  const res = await request.post("/api/links", {
    headers: { cookie },
    data: { url: raw },
  });
  expect(res.status()).toBe(201);
  const { slug } = (await res.json()) as { slug: string };

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  let stored: string;
  try {
    const { rows } = await db.query(
      `SELECT target_url FROM link WHERE slug = $1`,
      [slug],
    );
    stored = rows[0].target_url as string;
  } finally {
    await db.end();
  }
  expect(stored, "the stored value must be canonical").toBe(
    new URL(raw).href,
  );
  expect(stored).not.toContain("Ċ");

  // …and the resolve seam still emits a well-formed 302 for it.
  const hit = await request.get(`/r/${slug}`, { maxRedirects: 0 });
  expect(hit.status()).toBe(302);
  expect(hit.headers()["location"]).toBe(stored);
});

test("SECURITY: embedded userinfo is refused (https://trusted.com@evil.tld/)", async ({
  request,
}) => {
  const cookie = await signupCookie(request);
  const before = await countLinks();
  for (const url of [
    "https://google.com@evil.example/",
    "https://user:pass@evil.example/path",
  ]) {
    const res = await request.post("/api/links", {
      headers: { cookie },
      data: { url },
    });
    expect(res.status(), `${url} must be refused`).toBe(400);
  }
  expect(await countLinks()).toBe(before);
});

test("AC-CREATE-7: the same url twice yields two links with distinct slugs (no dedup)", async ({
  request,
}) => {
  const cookie = await signupCookie(request);
  const url = "https://example.com/same-target";
  const a = await request.post("/api/links", { headers: { cookie }, data: { url } });
  const b = await request.post("/api/links", { headers: { cookie }, data: { url } });
  expect(a.status()).toBe(201);
  expect(b.status()).toBe(201);
  const slugA = ((await a.json()) as { slug: string }).slug;
  const slugB = ((await b.json()) as { slug: string }).slug;
  expect(slugA).not.toBe(slugB);
});
