/**
 * Who is acting, and whether they may.
 *
 * Every protected route calls `requireUser`. It resolves the session, loads the
 * current user row, and checks the role and, where it matters, the phone
 * verification. AUTH-6: the check is server side, it happens before any work,
 * and hiding a link is never what stands between a user and an action.
 *
 * A refusal is returned, not thrown, so callers turn it into a 401 or 403. A
 * thrown error would read as a 500, which is the same reasoning `applyTrigger`
 * follows for the state machine.
 *
 * The user row is read fresh rather than trusted from the session token,
 * because `phoneVerified` changes during a session and a stale token would let
 * an unverified account through, or keep a verified one out.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Role, User } from "@prisma/client";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export type Guard =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

type Requirements = {
  /** One role, or any of several. Omitted means any signed-in user. */
  role?: Role | readonly Role[];
  /** AUTH-3: listing an item and paying a deposit both require this. */
  verifiedPhone?: boolean;
};

const NO_STORE = { "cache-control": "no-store" };

function refuse(status: number, body: Record<string, unknown>): Guard {
  return { ok: false, response: NextResponse.json(body, { status, headers: NO_STORE }) };
}

/** The signed-in user, or null. Safe to call from a page as well as a route. */
export async function getSessionUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) return null;

  // A session can outlive its user: the row may have been removed since.
  return prisma.user.findUnique({ where: { email } });
}

export async function requireUser(requirements: Requirements = {}): Promise<Guard> {
  const user = await getSessionUser();

  // 401 and 403 are kept distinct so a refusal is legible while debugging.
  // Neither body says anything about what was being reached.
  if (!user) {
    return refuse(401, { error: "Sign in to continue." });
  }

  if (requirements.role) {
    const allowed = Array.isArray(requirements.role)
      ? requirements.role
      : [requirements.role];

    if (!allowed.includes(user.role)) {
      return refuse(403, { error: "This is not available on your account." });
    }
  }

  if (requirements.verifiedPhone && !user.phoneVerified) {
    return refuse(403, {
      error: "Verify your phone number before continuing.",
      // Named so the interface can link there rather than guessing the cause.
      verifyPath: "/verify-phone",
    });
  }

  return { ok: true, user };
}
