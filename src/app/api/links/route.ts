// POST /api/links — create a short link (feat-handbook-acme-links-create-link).
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { link } from "@/db/schema";
import { generateSlug } from "@/lib/links/slug";
import { normalizeTargetUrl } from "@/lib/links/url-policy";

const INSERT_ATTEMPTS = 5;

function isUniqueViolation(err: unknown): boolean {
  const code =
    (err as { code?: string })?.code ??
    ((err as { cause?: { code?: string } })?.cause?.code as string | undefined);
  return code === "23505";
}

export async function POST(req: Request) {
  // AC-CREATE-2: enforced in the handler — anonymous callers create nothing.
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "a JSON body with {url} is required" }, { status: 400 });
  }
  const targetUrl = normalizeTargetUrl(body.url);
  if (targetUrl === null) {
    return Response.json(
      { error: "url must be an absolute http(s) URL of at most 2048 characters" },
      { status: 400 },
    );
  }

  // AC-CREATE-5: the unique constraint is the arbiter; a generation collision
  // is retried with a fresh slug, never persisted twice.
  for (let attempt = 0; attempt < INSERT_ATTEMPTS; attempt++) {
    const slug = generateSlug();
    try {
      await db.insert(link).values({
        id: randomUUID(),
        userId: session.user.id,
        slug,
        targetUrl,
      });
      // Configuration, never the request's Host header — a spoofed Host would
      // otherwise mint shortUrls pointing at someone else's origin.
      const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
      return Response.json(
        { slug, shortUrl: `${base}/r/${slug}` },
        { status: 201 },
      );
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  return Response.json({ error: "could not allocate a slug" }, { status: 500 });
}
