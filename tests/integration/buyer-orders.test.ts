/**
 * A buyer's orders, at the database seam.
 *
 * Paying a deposit used to end at the confirmation page, which is reachable
 * only from the checkout that produced it. These reads give a buyer a way back
 * to what they paid for: a list of their orders and a page per order.
 *
 * The rule worth testing is the scoping. An order id in a URL must not be a
 * way into somebody else's purchase.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { getBuyerOrderList, getOrderForBuyer } = await import("@/lib/orders");
const { placeOrders } = await import("@/lib/checkout");

async function boughtItem(
  buyerId: string,
  overrides: { title?: string; price?: string } = {},
) {
  const seller = await makeUser("seller");
  const item = await makeItem(seller.id, {
    title: overrides.title ?? "Yamaha guitar",
    price: overrides.price ?? "72000.00",
  });
  const placed = await placeOrders(buyerId, [item.id]);
  if (!placed.ok) throw new Error("checkout failed");
  return { item, orderId: placed.orders[0].id };
}

describe("a buyer's order list", () => {
  it("returns their orders with the figures and the item", async () => {
    const buyer = await makeUser("buyer");
    await boughtItem(buyer.id, { title: "Yamaha guitar", price: "72000.00" });

    const [row] = await getBuyerOrderList(buyer.id);

    expect(row).toMatchObject({
      itemTitle: "Yamaha guitar",
      depositAmount: "7200",
      balanceAmount: "64800",
      listedPrice: "72000",
      status: "deposit_paid",
    });
    expect(row.reference).toMatch(/^DCL-[A-Z0-9]{8}$/);
    expect(row.thumbnail).toBe("/seed/test-1.svg");
  });

  it("returns nobody else's orders", async () => {
    const buyer = await makeUser("buyer");
    const other = await makeUser("buyer");
    await boughtItem(buyer.id, { title: "Mine" });
    await boughtItem(other.id, { title: "Theirs" });

    const rows = await getBuyerOrderList(buyer.id);

    expect(rows.map((r) => r.itemTitle)).toEqual(["Mine"]);
  });

  it("puts the newest order first", async () => {
    const buyer = await makeUser("buyer");
    const first = await boughtItem(buyer.id, { title: "first" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await boughtItem(buyer.id, { title: "second" });

    const rows = await getBuyerOrderList(buyer.id);

    expect(rows.map((r) => r.id)).toEqual([second.orderId, first.orderId]);
  });

  it("returns an empty list for a buyer who has ordered nothing", async () => {
    const buyer = await makeUser("buyer");

    expect(await getBuyerOrderList(buyer.id)).toEqual([]);
  });

  it("shows an order whose hold has lapsed as expired, and keeps it listed", async () => {
    const buyer = await makeUser("buyer");
    const { orderId } = await boughtItem(buyer.id);
    await testDb.order.update({
      where: { id: orderId },
      data: { holdExpiresAt: new Date(Date.now() - 3600_000) },
    });

    const [row] = await getBuyerOrderList(buyer.id);

    // The hold is released on read, so the buyer sees what actually happened
    // rather than a reservation that no longer exists.
    expect(row.status).toBe("expired");
    expect(row.id).toBe(orderId);
  });
});

describe("one order", () => {
  it("returns the order with its deposit, balance and hold expiry", async () => {
    const buyer = await makeUser("buyer");
    const { orderId } = await boughtItem(buyer.id, { price: "72000.00" });

    const order = await getOrderForBuyer(orderId, buyer.id);

    expect(order).toMatchObject({
      id: orderId,
      depositAmount: "7200",
      balanceAmount: "64800",
      status: "deposit_paid",
    });
    expect(new Date(order!.holdExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null for another buyer's order", async () => {
    const buyer = await makeUser("buyer");
    const other = await makeUser("buyer");
    const { orderId } = await boughtItem(other.id);

    expect(await getOrderForBuyer(orderId, buyer.id)).toBeNull();
  });

  it("returns null for an order that does not exist", async () => {
    const buyer = await makeUser("buyer");

    expect(await getOrderForBuyer("never-existed", buyer.id)).toBeNull();
  });

  it("carries no seller contact details, which a deposit does not yet unlock here", async () => {
    const buyer = await makeUser("buyer");
    const { orderId } = await boughtItem(buyer.id);
    const seller = await testDb.user.findFirstOrThrow({ where: { role: "seller" } });

    const order = await getOrderForBuyer(orderId, buyer.id);

    const serialised = JSON.stringify(order);
    expect(serialised).not.toContain(seller.phone);
    expect(serialised).not.toContain(seller.email);
    expect(serialised).not.toContain(seller.firstName);
  });
});
