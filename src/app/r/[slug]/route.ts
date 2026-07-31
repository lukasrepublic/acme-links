// GET /r/:slug — the resolve seam (feat-handbook-acme-links-resolve-redirect).
// Public, unauthenticated. Looks the slug up, counts the click atomically, and
// 302-redirects to EXACTLY the stored target.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { link } from "@/db/schema";

// AC-RESOLVE-5: slugs are base62; anything longer or stranger is a clean 404
// before it reaches the database.
const SLUG_SHAPE = /^[A-Za-z0-9]{1,32}$/;

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

function isSafeTarget(target: string): boolean {
  // AC-RESOLVE-2: read-side scheme guard — never emit a non-http(s) Location,
  // even if a dangerous target somehow reached the database.
  try {
    const url = new URL(target);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!SLUG_SHAPE.test(slug)) return notFound();

  const rows = await db
    .select({ id: link.id, targetUrl: link.targetUrl })
    .from(link)
    .where(eq(link.slug, slug))
    .limit(1);
  const found = rows[0];
  if (!found) return notFound();
  if (!isSafeTarget(found.targetUrl)) return notFound();

  // AC-RESOLVE-3: a single DB-level increment — concurrent resolves never
  // lose updates (no read-modify-write).
  await db
    .update(link)
    .set({ clicks: sql`${link.clicks} + 1` })
    .where(eq(link.id, found.id));

  return new Response(null, {
    status: 302,
    headers: {
      Location: found.targetUrl,
      // AC-RESOLVE-6: a cached redirect is a poisoned redirect.
      "Cache-Control": "no-store",
    },
  });
}
