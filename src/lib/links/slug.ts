// Slug generation (feat-handbook-acme-links-create-link, AC-CREATE-5/-6):
// 7 chars of base62 drawn from a cryptographically-secure RNG — ~3.5e12
// values, unguessable and non-enumerable. Collisions are handled by the
// caller retrying against the unique constraint.
import { randomInt } from "crypto";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const SLUG_LENGTH = 7;

export function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += ALPHABET[randomInt(ALPHABET.length)];
  }
  return slug;
}
