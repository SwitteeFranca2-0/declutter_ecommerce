"use client";

/**
 * NextAuth's session context, so the header and the sign-in forms can read the
 * session on the client without a request of their own.
 *
 * Nothing security-relevant depends on this. Every server-side decision goes
 * through `requireUser`, which re-reads the user row.
 */

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
