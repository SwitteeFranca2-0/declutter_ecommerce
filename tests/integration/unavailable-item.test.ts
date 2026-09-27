/**
 * Reading an item that exists but cannot be bought, at the database seam.
 *
 * Until now a real-but-unavailable item and an invented id were deliberately
 * indistinguishable, so nobody could probe which ids exist. That held the
 * privacy line and left a buyer whose cart item vanished with no idea which
 * item went.
 *
 * The rule now: a **real** id shows the item with a reason it cannot be
 * bought; an invented id still shows nothing. Ids are cuids, so the surface
 * this opens is an attacker who already holds a valid id, which means they
 * already saw the item.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { getItemForDisplay, getListedItem } = await import("@/lib/items");

describe("an item that cannot be bought", () => {
  it("comes back with its title, image and price, and a reason", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, {
      status: "on_hold",
      title: "Canon EOS 600D body",
      price: "98000.00",
    });

    const view = await getItemForDisplay(item.id);

    expect(view).not.toBeNull();
    expect(view!.available).toBe(false);
    expect(view!.item.title).toBe("Canon EOS 600D body");
    expect(view!.item.listedPrice).toBe("98000");
    expect(view!.item.images[0].url).toBe("/seed/test-1.svg");
    expect(view!.reason).toBe("Reserved by another buyer");
  });

  it.each([
    ["sold", "Sold"],
    ["completed", "Sold"],
    ["rejected", "No longer listed"],
    ["pending_review", "No longer listed"],
  ] as const)("explains a %s item as '%s'", async (status, reason) => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { status });

    const view = await getItemForDisplay(item.id);

    expect(view!.available).toBe(false);
    expect(view!.reason).toBe(reason);
  });

  it("returns null for an id that was never issued", async () => {
    expect(await getItemForDisplay("never-existed")).toBeNull();
  });

  it("returns null for an item deleted from the database", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);
    await testDb.item.delete({ where: { id: item.id } });

    expect(await getItemForDisplay(item.id)).toBeNull();
  });

  it("marks a listed item available, with no reason", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);

    const view = await getItemForDisplay(item.id);

    expect(view!.available).toBe(true);
    expect(view!.reason).toBeNull();
  });

  it("becomes available again once a lapsed hold is released", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id, { status: "on_hold" });
    await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: buyer.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        status: "deposit_paid",
        holdExpiresAt: new Date(Date.now() - 3600_000),
      },
    });

    const view = await getItemForDisplay(item.id);

    expect(view!.available).toBe(true);
  });

  it("never carries the seller's identity", async () => {
    const seller = await makeUser("seller", { firstName: "Sade" });
    const item = await makeItem(seller.id, { status: "sold" });

    const view = await getItemForDisplay(item.id);

    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain(seller.firstName);
    expect(serialised).not.toContain(seller.email);
    expect(serialised).not.toContain(seller.phone);
  });
});

describe("the buying path is unchanged", () => {
  it("still refuses to return an unavailable item as listed", async () => {
    const seller = await makeUser("seller");
    const held = await makeItem(seller.id, { status: "on_hold" });
    const sold = await makeItem(seller.id, { status: "sold" });

    expect(await getListedItem(held.id)).toBeNull();
    expect(await getListedItem(sold.id)).toBeNull();
  });
});
