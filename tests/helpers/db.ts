/**
 * Database helpers shared by every integration test.
 *
 * Written once here, in slice 02, and copied by every later slice. The
 * repository has no prior art, so this deserves more care than the feature it
 * first serves.
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

export const testDb = new PrismaClient();

/** Empty every table. Order matters: children before parents. */
export async function resetDb() {
  await testDb.payout.deleteMany();
  await testDb.message.deleteMany();
  await testDb.thread.deleteMany();
  await testDb.order.deleteMany();
  await testDb.itemImage.deleteMany();
  await testDb.item.deleteMany();
  await testDb.user.deleteMany();
}

/** Cheap hash: these tests never assert on password strength. */
async function testPasswordHash() {
  return hash("test-password", 4);
}

export async function makeUser(
  role: "buyer" | "seller" | "admin",
  overrides: Partial<{ email: string; phoneVerified: boolean; firstName: string }> = {},
) {
  return testDb.user.create({
    data: {
      role,
      email: overrides.email ?? `${role}-${crypto.randomUUID()}@test.local`,
      phone: "+2348000000000",
      phoneVerified: overrides.phoneVerified ?? true,
      passwordHash: await testPasswordHash(),
      firstName: overrides.firstName ?? "Test",
    },
  });
}

type ItemOverrides = Partial<{
  status: "pending_review" | "rejected" | "listed" | "on_hold" | "sold" | "completed";
  category: "electronics" | "furniture" | "appliances" | "fashion" | "books" | "other";
  title: string;
  price: string;
  payout: string;
  images: number;
}>;

export async function makeItem(sellerId: string, overrides: ItemOverrides = {}) {
  const images = overrides.images ?? 2;

  return testDb.item.create({
    data: {
      sellerId,
      title: overrides.title ?? "Test item",
      description: "A description long enough to be realistic.",
      category: overrides.category ?? "electronics",
      condition: "good",
      sellerPayoutAmount: overrides.payout ?? "40000.00",
      listedPrice: overrides.price ?? "50000.00",
      status: overrides.status ?? "listed",
      images: {
        create: Array.from({ length: images }, (_, i) => ({
          url: `/seed/test-${i + 1}.svg`,
          sortOrder: i,
        })),
      },
    },
    include: { images: true },
  });
}
