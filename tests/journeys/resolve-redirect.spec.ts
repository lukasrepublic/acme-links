/* Contract journeys — feat-handbook-acme-links-resolve-redirect (AC-RESOLVE-1..6).
   These drive the RUNNING app at the seam the frozen acceptance contract names.
   Fixtures are seeded straight into the database (deliberately bypassing the
   write-side API: AC-RESOLVE-2 exists precisely for rows the API would refuse). */
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://acme:acme@localhost:5433/acme";

const CANARY_TARGET = "https://example.com/acme-canary-9f3";

async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

test.beforeAll(async () => {
  await withDb(async (db) => {
    await db.query(
      `INSERT INTO "user"(id, name, email) VALUES ('seed-user', 'Seed', 'seed@acme.example')
       ON CONFLICT (id) DO NOTHING`,
    );
    await db.query(`DELETE FROM link WHERE user_id = 'seed-user'`);
    await db.query(
      `INSERT INTO link(id, user_id, slug, target_url, clicks) VALUES
       ('seed-link',    'seed-user', 'canary7',  $1, 0),
       ('seed-badurl',  'seed-user', 'badproto', 'javascript:alert(1)', 0),
       ('seed-counter', 'seed-user', 'clicks00', 'https://example.com/counted', 0)`,
      [CANARY_TARGET],
    );
  });
});

test("AC-RESOLVE-1: GET /r/canary7 → 302 with Location EXACTLY the stored target (the money shot)", async ({
  request,
}) => {
  const res = await request.get("/r/canary7", { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toBe(CANARY_TARGET);
});

test("AC-RESOLVE-2: a stored non-http(s) target resolves 404 — the read-side scheme guard", async ({
  request,
}) => {
  const res = await request.get("/r/badproto", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
  expect(res.headers()["location"]).toBeUndefined();
});

test("AC-RESOLVE-3: 100 concurrent resolves increment the click count by exactly 100 (atomic)", async ({
  request,
}) => {
  const results = await Promise.all(
    Array.from({ length: 100 }, () =>
      request.get("/r/clicks00", { maxRedirects: 0 }),
    ),
  );
  for (const r of results) expect(r.status()).toBe(302);
  const clicks = await withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT clicks FROM link WHERE slug = 'clicks00'`,
    );
    return rows[0].clicks as number;
  });
  expect(clicks).toBe(100);
});

test("AC-RESOLVE-4: GET /r/<unknown slug> → 404", async ({ request }) => {
  const res = await request.get("/r/n0such1", { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test("AC-RESOLVE-5: malformed / oversized / traversal-shaped slugs → 404, never a 500", async ({
  request,
}) => {
  const shapes = [
    "/r/..%2F..%2Fetc%2Fpasswd",
    "/r/" + "a".repeat(300),
    "/r/has%20space",
    "/r/%27%20OR%201=1--",
  ];
  for (const path of shapes) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} must 404 cleanly`).toBe(404);
    const body = await res.text();
    expect(body).not.toMatch(/at .*\.ts|SyntaxError|pg_|drizzle/i);
  }
});

test("AC-RESOLVE-6: the 302 carries Cache-Control: no-store (no poisoned-redirect caching)", async ({
  request,
}) => {
  const res = await request.get("/r/canary7", { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["cache-control"]).toContain("no-store");
});
