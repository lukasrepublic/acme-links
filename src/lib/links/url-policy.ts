// Write-side URL policy (feat-handbook-acme-links-create-link, AC-CREATE-3/-4).
// The first line of defense for the public redirect surface; the resolver
// carries its own read-side guard (defense-in-depth, not trust).

export const MAX_URL_LENGTH = 2048;

/** Normalize then validate, and return the CANONICAL form — never the raw
 *  input. Validating one representation while storing another is how a
 *  checked URL turns into an unchecked `Location` header: the parser accepts
 *  codepoints it would have percent-encoded (U+010A/U+010D are CR/LF with a
 *  high byte attached), and the raw string keeps them. Returning `url.href`
 *  means the bytes we approved are exactly the bytes we store and emit.
 *
 *  Returns the canonical URL, or null when the submission must be refused. */
export function normalizeTargetUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Strip C0/C1 control characters the way a browser would before parsing —
  // this is what makes 'java\tscript:' refusable rather than parseable.
  // Widening this class changes the ACCEPT set, not just the reject set.
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.trim().replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  if (cleaned.length === 0 || cleaned.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  // URL() lower-cases the scheme, so ' Javascript:' and 'java\tscript:' land
  // here as 'javascript:' — refused.
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Embedded userinfo is a phishing disguise (https://google.com@evil.tld/
  // reads as google.com and goes to evil.tld) and a credential-at-rest sink;
  // canonicalization does NOT strip it, so refuse it explicitly.
  if (url.username !== "" || url.password !== "") return null;
  const canonical = url.href;
  // Percent-encoding can grow the string past the bound measured above.
  if (canonical.length > MAX_URL_LENGTH) return null;
  return canonical;
}
