// Better Auth wiring (feat-handbook-acme-links-auth): email+password sessions,
// Drizzle adapter, no OAuth, no external service.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
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
    // forced on (modern browsers treat localhost as a trustworthy origin).
    useSecureCookies: true,
  },
});

export type Session = typeof auth.$Infer.Session;
