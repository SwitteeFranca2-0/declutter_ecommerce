/**
 * Who is buying.
 *
 * `Order.buyerId` is not nullable and this data model has no concept of a guest
 * order. Rather than weaken the schema, every call site asks this one function.
 *
 * Stage A returned a seeded demo buyer here, because authentication did not
 * exist. Since slice 07 it returns the signed-in user, and the fallback is
 * gone: a silent default would let an unauthenticated checkout succeed and
 * record the order against somebody else. Callers that need a refusal rather
 * than a null use `requireUser` instead.
 */

import type { User } from "@prisma/client";

import { getSessionUser } from "@/lib/session";

export async function getActingBuyer(): Promise<User | null> {
  return getSessionUser();
}
