// Better Auth wiring (feat-handbook-acme-links-auth): email+password sessions,
// Drizzle adapter, no OAuth, no external service.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Fail closed on a missing secret. Left unset, Better Auth silently falls back
// to its own published default outside production — every session cookie in
// the deployment would then be forgeable by anyone who read the library.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set — copy .env.example to .env and generate one: openssl rand -base64 32",
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret,
  baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    // Stated here, not left to a library default — and matched by the form.
    minPasswordLength: 8,
    // AC-AUTH-2: a recognizable one-way hash format ($2b$…), never plaintext.
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  session: {
    // AC-AUTH-8: bounded TTL (7 days); a fresh session (new token) per login.
    expiresIn: 60 * 60 * 24 * 7,
  },
  advanced: {
    // AC-AUTH-8: HttpOnly + SameSite=Lax are Better Auth defaults; Secure is
    // forced on. Browsers treat localhost as a trustworthy origin, so this
    // works in dev — but it means the app REQUIRES TLS anywhere else: served
    // over plain HTTP off localhost the browser drops the cookie and login
    // silently does nothing. See README, "Running it somewhere real".
    useSecureCookies: true,
  },
});

export type Session = typeof auth.$Infer.Session;
