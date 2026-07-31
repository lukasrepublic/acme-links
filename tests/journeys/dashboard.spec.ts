/* Contract journeys — feat-handbook-acme-links-dashboard (AC-DASH-1..7).
   AC-DASH-2 is the attributable cross-tenant check: the number of B's slugs
   visible in A's dashboard must be exactly 0 — a no-WHERE leak goes RED. */
import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import { randomUUID } from "crypto";
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://acme:acme@localhost:5433/acme";
const PASSWORD = "hunter2pass";

let n = 0;
const uniqueEmail = () => `dash-${Date.now()}-${n++}@acme.test`;

function cookieHeader(res: APIResponse): string {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0])
    .filter((c) => !/=\s*$/.test(c))
    .join("; ");
}

async function newUser(
  request: APIRequestContext,
): Promise<{ cookie: string; email: string }> {
  const email = uniqueEmail();
  const res = await request.post("/signup", {
    data: { email, password: PASSWORD },
  });
  expect(res.status()).toBe(200);
  return { cookie: cookieHeader(res), email };
}

async function createLink(
  request: APIRequestContext,
  cookie: string,
  url: string,
): Promise<string> {
  const res = await request.post("/api/links", {
    headers: { cookie },
    data: { url },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { slug: string }).slug;
}

test("AC-DASH-1: authed GET /dashboard → 200 listing the user's links with click counts", async ({
  request,
}) => {
  const a = await newUser(request);
  const slug = await createLink(request, a.cookie, "https://example.com/mine");
  // Register one click so the count column shows a real number.
  await request.get(`/r/${slug}`, { maxRedirects: 0 });

  const res = await request.get("/dashboard", {
    headers: { cookie: a.cookie },
  });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain(`/r/${slug}`);
  expect(html).toContain("https://example.com/mine");
});

test("AC-DASH-2: ownership isolation — zero of B's slugs appear in A's dashboard", async ({
  request,
}) => {
  const a = await newUser(request);
  const b = await newUser(request);
  const aSlugs = await Promise.all([
    createLink(request, a.cookie, "https://example.com/a/1"),
    createLink(request, a.cookie, "https://example.com/a/2"),
  ]);
  const bSlugs = await Promise.all([
    createLink(request, b.cookie, "https://example.com/b/1"),
    createLink(request, b.cookie, "https://example.com/b/2"),
    createLink(request, b.cookie, "https://example.com/b/3"),
  ]);

  const res = await request.get("/dashboard", {
    headers: { cookie: a.cookie },
  });
  expect(res.status()).toBe(200);
  const html = await res.text();
  for (const slug of aSlugs) expect(html).toContain(slug);
  const leaked = bSlugs.filter((slug) => html.includes(slug));
  expect(leaked, "cross-tenant leak — B's links visible to A").toHaveLength(0);
});

test("AC-DASH-3: anonymous GET /dashboard → 307 to /login; middleware-bypass header changes nothing", async ({
  request,
}) => {
  const bare = await request.get("/dashboard", { maxRedirects: 0 });
  expect(bare.status()).toBe(307);
  expect(bare.headers()["location"]).toContain("/login");

  const spoofed = await request.get("/dashboard", {
    maxRedirects: 0,
    headers: {
      "x-middleware-subrequest": "middleware:middleware:middleware:middleware:middleware",
    },
  });
  expect(spoofed.status()).toBe(307);
  expect(await spoofed.text()).not.toContain("Your links");
});

test("AC-DASH-4: a user with no links gets 200 with the defined empty-state", async ({
  request,
}) => {
  const fresh = await newUser(request);
  const res = await request.get("/dashboard", {
    headers: { cookie: fresh.cookie },
  });
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain("empty-state");
  expect(html).toContain("No links yet");
});

test("AC-DASH-5: a stored HTML/JS payload renders escaped — inert, never executed", async ({
  request,
}) => {
  const a = await newUser(request);
  const me = await request.get("/api/me", { headers: { cookie: a.cookie } });
  const userId = ((await me.json()) as { user: { id: string } }).user.id;

  // Seeded straight into the database, deliberately bypassing the write-side
  // policy — which now canonicalizes and would percent-encode this payload.
  // The dashboard must render safely whatever is STORED: a row written before
  // that policy existed, or by any other path, is exactly the case this guards.
  const payload = 'https://example.com/"><script>alert(1)</script>';
  const slug = `xss${randomUUID().slice(0, 4)}`;
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      `INSERT INTO link(id, user_id, slug, target_url) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, slug, payload],
    );
  } finally {
    await db.end();
  }

  const dash = await request.get("/dashboard", {
    headers: { cookie: a.cookie },
  });
  const html = await dash.text();
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>alert(1)</script>");
});

test("SECURITY: the authenticated dashboard is never cacheable", async ({
  request,
}) => {
  const a = await newUser(request);
  await createLink(request, a.cookie, "https://example.com/private");
  const res = await request.get("/dashboard", {
    headers: { cookie: a.cookie },
  });
  expect(res.status()).toBe(200);
  // One tenant's link table behind any shared cache is one tenant's data
  // served to another. The value is currently the framework's default for an
  // uncached dynamic route — asserted here so a later `revalidate`, a
  // `"use cache"` wrapper, or a config change cannot silently loosen it.
  const cacheControl = res.headers()["cache-control"] ?? "";
  expect(cacheControl).toContain("no-store");
  expect(cacheControl).toContain("private");
});

test("SECURITY: a stored slug that fails the shape guard is not rendered into an href", async ({
  request,
}) => {
  const a = await newUser(request);
  const me = await request.get("/api/me", { headers: { cookie: a.cookie } });
  const userId = ((await me.json()) as { user: { id: string } }).user.id;

  // Seeded directly — the write side would never mint this. The renderer must
  // not take stored bytes into a URL sink just because it usually generates them.
  // Unique per run: a fixed literal makes the journey pass once against a fresh
  // database and fail on every rerun — green in CI, broken for anyone running it twice.
  const hostile = `../../evil-${randomUUID().slice(0, 8)}?x=#`;
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      `INSERT INTO link(id, user_id, slug, target_url) VALUES ($1, $2, $3, 'https://example.com/ok')`,
      [randomUUID(), userId, hostile],
    );
  } finally {
    await db.end();
  }

  const dash = await request.get("/dashboard", {
    headers: { cookie: a.cookie },
  });
  const html = await dash.text();
  expect(html).not.toContain(`href="/r/${hostile}`);
  expect(html).not.toContain('href="/r/../../evil');
});

test("AC-DASH-6: the dashboard is composed from design-system components, not ad-hoc markup", async ({
  request,
}) => {
  const a = await newUser(request);
  await createLink(request, a.cookie, "https://example.com/styled");
  const res = await request.get("/dashboard", {
    headers: { cookie: a.cookie },
  });
  const html = await res.text();
  for (const cls of ['class="shell-nav"', '"card', '"table', '"badge']) {
    expect(html).toContain(cls);
  }
});

test("AC-DASH-7: newest first, and the listing is bounded at one page", async ({
  request,
}) => {
  const a = await newUser(request);
  const first = await createLink(request, a.cookie, "https://example.com/old");
  const second = await createLink(request, a.cookie, "https://example.com/new");

  const res = await request.get("/dashboard", {
    headers: { cookie: a.cookie },
  });
  const html = await res.text();
  expect(html.indexOf(second), "newest link renders first").toBeLessThan(
    html.indexOf(first),
  );

  // Bound: seed a user with 55 links straight into the DB; only 50 render.
  const bulk = await newUser(request);
  const me = await request.get("/api/me", {
    headers: { cookie: bulk.cookie },
  });
  const userId = ((await me.json()) as { user: { id: string } }).user.id;
  const slugs = Array.from({ length: 55 }, (_, i) => `bnd${i}${randomUUID().slice(0, 4)}`);
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    for (const slug of slugs) {
      await db.query(
        `INSERT INTO link(id, user_id, slug, target_url, created_at)
         VALUES ($1, $2, $3, 'https://example.com/bulk', now() + interval '1 second' * $4)`,
        [randomUUID(), userId, slug, slugs.indexOf(slug)],
      );
    }
  } finally {
    await db.end();
  }
  const bulkDash = await request.get("/dashboard", {
    headers: { cookie: bulk.cookie },
  });
  const bulkHtml = await bulkDash.text();
  const rendered = slugs.filter((slug) => bulkHtml.includes(slug)).length;
  expect(rendered).toBe(50);
});
