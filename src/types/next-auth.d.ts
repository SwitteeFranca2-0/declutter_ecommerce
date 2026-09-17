/**
 * Session shape.
 *
 * NextAuth's default session user carries name, email and image only. The id
 * and role are added in the callbacks, so they are declared here rather than
 * reached for with a cast at every call site.
 *
 * These are a convenience for the interface. Every server-side decision reads
 * the current user row through `requireUser`, so nothing security-relevant
 * depends on what a token claims.
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
