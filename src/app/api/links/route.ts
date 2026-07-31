// POST /api/links — create a short link (feat-handbook-acme-links-create-link).
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { link } from "@/db/schema";
import { bodyTooLarge, isCrossSiteRequest } from "@/lib/auth/http";
import { isRateLimited, recordEvent } from "@/lib/auth/rate-limit";
import { generateSlug } from "@/lib/links/slug";
import { normalizeTargetUrl } from "@/lib/links/url-policy";

const INSERT_ATTEMPTS = 5;
// Per-user creation bound, per 60s window (the limiter's window).
const MAX_LINKS_PER_WINDOW = 300;

function isUniqueViolation(err: unknown): boolean {
  const code =
    (err as { code?: string })?.code ??
    ((err as { cause?: { code?: string } })?.cause?.code as string | undefined);
  return code === "23505";
}

export async function POST(req: Request) {
  // The same cross-site guard the credential routes carry. Not exploitable
  // today (a cross-site JSON fetch is preflighted, and the text/plain trick is
  // blocked by the explicit SameSite=Lax) — but that safety lives in another
  // file's cookie attribute, so this route states its own requirement.
  if (isCrossSiteRequest(req)) {
    return Response.json({ error: "cross-site request refused" }, { status: 403 });
  }
  // AC-CREATE-2: enforced in the handler — anonymous callers create nothing.
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  // Bound the body BEFORE reading it: App Router handlers have no default
  // size limit, so an unbounded read is a memory DoS an open signup makes free.
  if (bodyTooLarge(req)) {
    return Response.json({ error: "request body too large" }, { status: 413 });
  }
  // A throughput bound on creation — open signup plus unlimited inserts is a
  // table-fill path. Set well above any human rate; it bounds scripts.
  const limitKey = `links:${session.user.id}`;
  if (isRateLimited(limitKey, MAX_LINKS_PER_WINDOW)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "a JSON body with {url} is required" }, { status: 400 });
  }
  const targetUrl = normalizeTargetUrl(body.url);
  if (targetUrl === null) {
    // Refusals count toward the limit: a script probing the URL policy is
    // exactly the traffic the bound is for.
    recordEvent(limitKey);
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
      recordEvent(limitKey);
      // Configuration, never the request's Host header — a spoofed Host would
      // otherwise mint shortUrls pointing at someone else's origin.
      const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
      return Response.json(
        { slug, shortUrl: `${base}/r/${slug}` },
        { status: 201 },
      );
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      // Never propagate: a DrizzleQueryError's message embeds the SQL and the
      // bound parameters (the user id and the full target URL).
      console.error("link insert failed", err);
      return Response.json({ error: "could not create link" }, { status: 500 });
    }
  }
  return Response.json({ error: "could not allocate a slug" }, { status: 500 });
}
