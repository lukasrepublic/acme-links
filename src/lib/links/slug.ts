// Slug generation (feat-handbook-acme-links-create-link, AC-CREATE-5/-6):
// 7 chars of base62 drawn from a cryptographically-secure RNG — ~3.5e12
// values, unguessable and non-enumerable. Collisions are handled by the
// caller retrying against the unique constraint.
import { randomInt } from "crypto";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const SLUG_LENGTH = 7;

/** Read-side shape guard. Stored slugs are trusted nowhere: a row written
 *  before the write-side policy existed — or by any other path — must not be
 *  able to steer a URL it is interpolated into. The resolver applies the same
 *  discipline to the slug it receives; this is the renderer's half. */
export function isValidSlug(slug: string): boolean {
  return /^[A-Za-z0-9]{1,32}$/.test(slug);
}

export function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += ALPHABET[randomInt(ALPHABET.length)];
  }
  return slug;
}
