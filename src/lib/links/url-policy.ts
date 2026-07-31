// Write-side URL policy (feat-handbook-acme-links-create-link, AC-CREATE-3/-4).
// The first line of defense for the public redirect surface; the resolver
// carries its own read-side guard (defense-in-depth, not trust).

export const MAX_URL_LENGTH = 2048;

/** Normalize then validate: trim, strip control characters, require an
 *  absolute http(s) URL within the stored-length bound. Returns the cleaned
 *  URL, or null when the submission must be refused. */
export function normalizeTargetUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.trim().replace(/[\u0000-\u001f\u007f]/g, "");
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
  return cleaned;
}
