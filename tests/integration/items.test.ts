/**
 * Reading items, at the database seam.
 *
 * Covers the two rules every read depends on: a lapsed hold puts the item back
 * on the marketplace, and an item that is not listed is indistinguishable from
 * one that does not exist.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

// The module under test holds its own Prisma client, pointed at the same test
// database by tests/helpers/setup.ts.
const { getListedItem, getListedItems, releaseLapsedHolds } = await import("@/lib/items");

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600 * 1000);

async function placeHold(itemId: string, buyerId: string, expiresAt: Date) {
  await testDb.item.update({ where: { id: itemId }, data: { status: "on_hold" } });
  return testDb.order.create({
    data: {
      itemId,
      buyerId,
      depositAmount: "5000.00",
      balanceAmount: "45000.00",
      status: "deposit_paid",
      holdExpiresAt: expiresAt,
    },
  });
}

describe("getListedItem", () => {
  it("returns a listed item with its images in sort order", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { status: "listed", images: 3 });

    const view = await getListedItem(item.id);

    expect(view).not.toBeNull();
    expect(view!.title).toBe("Test item");
    expect(view!.images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it("derives the deposit and balance from the stored price", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { price: "215000.00" });

    const view = await getListedItem(item.id);

    expect(view!.deposit).toBe("21500");
    expect(view!.balance).toBe("193500");
  });

  it("returns null for an item that does not exist", async () => {
    expect(await getListedItem("does-not-exist")).toBeNull();
  });

  it.each(["pending_review", "rejected", "sold", "completed"] as const)(
    "returns null for a %s item, the same as one that does not exist",
    async (status) => {
      const seller = await makeUser("seller");
      const item = await makeItem(seller.id, { status });

      expect(await getListedItem(item.id)).toBeNull();
    },
  );
});

describe("hold expiry on read", () => {
  it("hides an item whose hold is still active", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    await placeHold(item.id, buyer.id, hoursFromNow(1));

    expect(await getListedItem(item.id)).toBeNull();
  });

  it("returns an item to the marketplace once its hold lapses", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    await placeHold(item.id, buyer.id, hoursFromNow(-1));

    // The read itself is what performs the transition.
    const view = await getListedItem(item.id);

    expect(view).not.toBeNull();
    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("listed");
  });

  it("marks the lapsed order expired, not just the item", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    const order = await placeHold(item.id, buyer.id, hoursFromNow(-1));

    await releaseLapsedHolds();

    const stored = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe("expired");
  });

  it("frees the item for a new buyer, which the partial index would otherwise refuse", async () => {
    const seller = await makeUser("seller");
    const first = await makeUser("buyer");
    const second = await makeUser("buyer");
    const item = await makeItem(seller.id);
    await placeHold(item.id, first.id, hoursFromNow(-1));

    await releaseLapsedHolds();

    const newOrder = await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: second.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        status: "deposit_paid",
        holdExpiresAt: hoursFromNow(72),
      },
    });
    expect(newOrder.id).toBeTruthy();
  });

  it("leaves everything alone when no hold has lapsed", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    await placeHold(item.id, buyer.id, hoursFromNow(48));

    expect(await releaseLapsedHolds()).toBe(0);
    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("on_hold");
  });

  it("does not touch a sold item whose order is past its hold window", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id, { status: "sold" });
    await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: buyer.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        // Balance paid: the hold window is irrelevant, the sale is done.
        status: "balance_paid",
        holdExpiresAt: hoursFromNow(-100),
      },
    });

    await releaseLapsedHolds();

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("sold");
  });
});

describe("getListedItems", () => {
  it("returns only listed items", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { status: "listed", title: "On sale" });
    await makeItem(seller.id, { status: "sold", title: "Gone" });
    await makeItem(seller.id, { status: "pending_review", title: "Waiting" });

    const items = await getListedItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("On sale");
  });

  it("brings every item's images back in the same query", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { images: 3 });
    await makeItem(seller.id, { images: 2 });

    const items = await getListedItems();

    expect(items.map((i) => i.images.length).sort()).toEqual([2, 3]);
  });
});
