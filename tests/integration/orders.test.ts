/**
 * Reading orders for the confirmation page, at the database seam.
 *
 * The confirmation page takes order ids from its URL, which anyone can edit,
 * so the read is scoped to the acting buyer.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { getBuyerOrders, placeOrders } = await import("@/lib/checkout");
const { getActingBuyer } = await import("@/lib/acting-buyer");

describe("getBuyerOrders", () => {
  it("returns the buyer's orders with reference, deposit, balance and thumbnail", async () => {
    const buyer = await makeUser("buyer");
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { title: "Bookshelf", price: "25000.00" });

    const placed = await placeOrders(buyer.id, [item.id]);
    if (!placed.ok) throw new Error("checkout failed");

    const orders = await getBuyerOrders(buyer.id, [placed.orders[0].id]);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      reference: placed.orders[0].reference,
      title: "Bookshelf",
      listedPrice: "25000",
      depositAmount: "2500",
      balanceAmount: "22500",
      thumbnail: "/seed/test-1.svg",
    });
  });

  it("does not reveal another buyer's order", async () => {
    const buyer = await makeUser("buyer");
    const someoneElse = await makeUser("buyer");
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);

    const placed = await placeOrders(someoneElse.id, [item.id]);
    if (!placed.ok) throw new Error("checkout failed");

    expect(await getBuyerOrders(buyer.id, [placed.orders[0].id])).toEqual([]);
  });

  it("returns nothing for unknown ids or none at all", async () => {
    const buyer = await makeUser("buyer");
    expect(await getBuyerOrders(buyer.id, [])).toEqual([]);
    expect(await getBuyerOrders(buyer.id, ["never-existed"])).toEqual([]);
  });
});

describe("getActingBuyer", () => {
  it("returns the signed-in user", async () => {
    const { actAs } = await import("../helpers/session-state");
    const buyer = await makeUser("buyer", { email: "acting@test.local" });

    actAs(buyer.email);
    expect((await getActingBuyer())?.id).toBe(buyer.id);
  });

  it("returns null when nobody is signed in, rather than a seeded fallback", async () => {
    const { actAs } = await import("../helpers/session-state");
    await makeUser("buyer", { email: "buyer1@declutter.test" });

    actAs(null);
    expect(await getActingBuyer()).toBeNull();
  });
});

describe("an item on hold leaves the catalogue immediately", () => {
  it("is no longer returned by the catalogue query once a deposit is paid", async () => {
    const { getListedItems } = await import("@/lib/items");
    const buyer = await makeUser("buyer");
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);

    expect((await getListedItems()).map((i) => i.id)).toContain(item.id);

    await placeOrders(buyer.id, [item.id]);

    expect((await getListedItems()).map((i) => i.id)).not.toContain(item.id);
  });
});
