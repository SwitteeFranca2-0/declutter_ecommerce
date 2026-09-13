/**
 * First test at the database seam, and the one that proves the infrastructure.
 *
 * Establishes the shape every later slice copies: reset, build fixtures, act,
 * assert on rows. Slice 03 adds route-handler tests on top of this.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

describe("catalogue visibility", () => {
  it("returns only listed items", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { status: "listed", title: "Visible" });
    await makeItem(seller.id, { status: "pending_review", title: "Awaiting review" });
    await makeItem(seller.id, { status: "on_hold", title: "Reserved" });
    await makeItem(seller.id, { status: "sold", title: "Sold" });
    await makeItem(seller.id, { status: "completed", title: "Collected" });
    await makeItem(seller.id, { status: "rejected", title: "Declined" });

    const listed = await testDb.item.findMany({ where: { status: "listed" } });

    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("Visible");
  });

  it("filters by category without leaking other statuses", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { category: "books", status: "listed" });
    await makeItem(seller.id, { category: "books", status: "on_hold" });
    await makeItem(seller.id, { category: "fashion", status: "listed" });

    const books = await testDb.item.findMany({
      where: { status: "listed", category: "books" },
    });

    expect(books).toHaveLength(1);
    expect(books[0].category).toBe("books");
  });
});

describe("money", () => {
  it("stores payout and listed price independently, with no rounding drift", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, {
      payout: "185000.00",
      price: "215000.33",
    });

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });

    // Decimal, not float. A float would not survive this comparison.
    expect(stored.listedPrice.toString()).toBe("215000.33");
    expect(stored.sellerPayoutAmount.toString()).toBe("185000");
  });
});

describe("images", () => {
  it("orders images so the lowest sortOrder is the thumbnail", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { images: 3 });

    const images = await testDb.itemImage.findMany({
      where: { itemId: item.id },
      orderBy: { sortOrder: "asc" },
    });

    expect(images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it("refuses two images at the same position", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { images: 1 });

    await expect(
      testDb.itemImage.create({
        data: { itemId: item.id, url: "/uploads/dupe.svg", sortOrder: 0 },
      }),
    ).rejects.toThrow();
  });
});

describe("one active order per item", () => {
  it("allows a single active order", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id, { status: "on_hold" });

    const order = await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: buyer.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        status: "deposit_paid",
        holdExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      },
    });

    expect(order.id).toBeTruthy();
  });

  it("refuses a second active order on the same item", async () => {
    const seller = await makeUser("seller");
    const buyerA = await makeUser("buyer");
    const buyerB = await makeUser("buyer");
    const item = await makeItem(seller.id, { status: "on_hold" });

    const deposit = (buyerId: string) => ({
      itemId: item.id,
      buyerId,
      depositAmount: "5000.00",
      balanceAmount: "45000.00",
      status: "deposit_paid" as const,
      holdExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    });

    await testDb.order.create({ data: deposit(buyerA.id) });

    // The partial unique index, not application code, is what refuses this.
    await expect(
      testDb.order.create({ data: deposit(buyerB.id) }),
    ).rejects.toThrow();
  });

  it("allows a new order once the previous one reached a terminal status", async () => {
    const seller = await makeUser("seller");
    const buyerA = await makeUser("buyer");
    const buyerB = await makeUser("buyer");
    const item = await makeItem(seller.id, { status: "listed" });
    const holdExpiresAt = new Date(Date.now() + 72 * 3600 * 1000);

    const first = await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: buyerA.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        status: "deposit_paid",
        holdExpiresAt,
      },
    });

    // An expired hold frees the item, which is what makes expiry-on-read work.
    await testDb.order.update({
      where: { id: first.id },
      data: { status: "expired" },
    });

    const second = await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: buyerB.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        status: "deposit_paid",
        holdExpiresAt,
      },
    });

    expect(second.id).toBeTruthy();
  });

  it("survives two concurrent deposits, letting exactly one win", async () => {
    const seller = await makeUser("seller");
    const buyerA = await makeUser("buyer");
    const buyerB = await makeUser("buyer");
    const item = await makeItem(seller.id, { status: "listed" });
    const holdExpiresAt = new Date(Date.now() + 72 * 3600 * 1000);

    const deposit = (buyerId: string) =>
      testDb.order.create({
        data: {
          itemId: item.id,
          buyerId,
          depositAmount: "5000.00",
          balanceAmount: "45000.00",
          status: "deposit_paid" as const,
          holdExpiresAt,
        },
      });

    const results = await Promise.allSettled([deposit(buyerA.id), deposit(buyerB.id)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await testDb.order.count({ where: { itemId: item.id } })).toBe(1);
  });
});
