/**
 * NextAuth configuration.
 *
 * Credentials provider only. No OAuth provider, because that would reintroduce
 * third-party keys the examiner does not have, which is the constraint the
 * whole stack is chosen against.
 *
 * Sessions are JWT cookies rather than database rows, so nothing is added to
 * the six tables in PRD §11 and a session survives a browser restart (AUTH-4).
 * The token carries only the user id, role and email: `phoneVerified` is
 * deliberately left out, because it changes mid-session and `requireUser`
 * reads the current row instead of trusting a stale claim.
 *
 * Kept separate from the route handler so pages, route handlers and tests can
 * import the options without importing the handler.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { verifyCredentials } from "@/lib/accounts";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        // Returns null for an unknown email and a wrong password alike, so the
        // form cannot be used to discover who has an account.
        const user = await verifyCredentials(credentials.email, credentials.password);

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.firstName,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        // `role` is carried for convenience in the interface only. Every
        // server-side decision re-reads the row through `requireUser`.
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : "";
        session.user.role = typeof token.role === "string" ? token.role : undefined;
      }
      return session;
    },
  },
};
