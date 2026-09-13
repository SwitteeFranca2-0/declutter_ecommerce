/**
 * Who is buying.
 *
 * `Order.buyerId` is not nullable and this data model has no concept of a guest
 * order. Rather than weaken the schema for a temporary gap, every call site asks
 * this one function.
 *
 * Stage A returns the seeded demo buyer, because authentication does not exist
 * yet. Stage B changes the body of this function to read the NextAuth session.
 * No call site changes. See issue #2.
 */

import { prisma } from "@/lib/prisma";

/** The seeded account checkout acts as until authentication lands. */
const STAGE_A_DEMO_BUYER_EMAIL = "buyer1@declutter.test";

export async function getActingBuyer() {
  const buyer = await prisma.user.findUnique({
    where: { email: STAGE_A_DEMO_BUYER_EMAIL },
  });

  if (!buyer) {
    throw new Error(
      `No acting buyer. Run 'npm run db:seed' to provision ${STAGE_A_DEMO_BUYER_EMAIL}.`,
    );
  }

  return buyer;
}
