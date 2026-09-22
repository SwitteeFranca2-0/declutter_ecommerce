/**
 * NextAuth's own routes: sign in, sign out, session, csrf.
 *
 * The configuration lives in `src/lib/auth-options.ts` so pages, guards and
 * tests can import it without importing this handler.
 */

import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth-options";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
