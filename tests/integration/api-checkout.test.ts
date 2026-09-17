/**
 * POST /api/checkout, at the route-handler seam.
 *
 * Checkout is the deposit step of the real escrow flow (BUY-7). These tests
 * cover what clicking cannot verify: server-side price authority against a
 * tampered payload, re-validation of the cart, all-or-nothing order creation,
 * and one active order per item under concurrency.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";
import { postJson } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { POST } = await import("@/app/api/checkout/route");

/** The seeded account checkout acts as until Stage B. See `src/lib/acting-buyer.ts`. */
const demoBuyer = () => makeUser("buyer", { email: "buyer1@declutter.test" });

const checkout = (payload: unknown) => postJson(POST, "/api/checkout", payload);
const accepted = (itemIds: unknown) => checkout({ itemIds, acceptedTerms: true });

const HOUR = 3600 * 1000;

describe("a successful checkout", () => {
  it("creates an order per item and places each item on hold", async () => {
    const buyer = await demoBuyer();
    const seller = await makeUser("seller");
    const a = await makeItem(seller.id, { price: "50000.00" });
    const b = await makeItem(seller.id, { price: "9500.00" });

    const { status, body } = await accepted([a.id, b.id]);

    expect(status).toBe(201);
    expect(body.orders).toHaveLength(2);

    const orders = await testDb.order.findMany({ orderBy: { createdAt: "asc" } });
    expect(orders).toHaveLength(2);
    expect(orders.every((o) => o.buyerId === buyer.id)).toBe(true);
    expect(orders.every((o) => o.status === "deposit_paid")).toBe(true);

    const items = await testDb.item.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(items.every((i) => i.status === "on_hold")).toBe(true);
  });

  it("records a deposit of 10% and the balance outstanding, from the stored price", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { price: "50000.00" });

    const { body } = await accepted([item.id]);

    const order = await testDb.order.findFirstOrThrow({ where: { itemId: item.id } });
    expect(order.depositAmount.toString()).toBe("5000");
    expect(order.balanceAmount.toString()).toBe("45000");
    expect(body.orders[0].depositAmount).toBe("5000");
    expect(body.orders[0].balanceAmount).toBe("45000");
  });

  it("sets the hold to expire 72 hours out", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);

    const before = Date.now();
    await accepted([item.id]);
    const after = Date.now();

    const order = await testDb.order.findFirstOrThrow({ where: { itemId: item.id } });
    const expires = order.holdExpiresAt.getTime();
    expect(expires).toBeGreaterThanOrEqual(before + 72 * HOUR - 1000);
    expect(expires).toBeLessThanOrEqual(after + 72 * HOUR + 1000);
  });

  it("returns an order reference for each order", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { title: "Standing desk" });

    const { body } = await accepted([item.id]);

    expect(body.orders[0].id).toEqual(expect.any(String));
    expect(body.orders[0].reference).toMatch(/^DCL-[A-Z0-9]{8}$/);
    expect(body.orders[0].itemId).toBe(item.id);
    expect(body.orders[0].title).toBe("Standing desk");
  });

  it("treats a duplicated identifier as one item, not two orders", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);

    const { status } = await accepted([item.id, item.id]);

    expect(status).toBe(201);
    expect(await testDb.order.count()).toBe(1);
  });
});

describe("server-side price authority, T-SERVER-PRICE", () => {
  it("ignores tampered amounts and never echoes them", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { price: "50000.00" });

    const { status, body } = await checkout({
      itemIds: [item.id],
      acceptedTerms: true,
      depositAmount: "1",
      total: "7",
      listedPrice: "13",
      prices: { [item.id]: "17" },
    });

    expect(status).toBe(201);

    const order = await testDb.order.findFirstOrThrow({ where: { itemId: item.id } });
    expect(order.depositAmount.toString()).toBe("5000");
    expect(order.balanceAmount.toString()).toBe("45000");

    const echoed = JSON.stringify(body);
    for (const tampered of ['"1"', '"7"', '"13"', '"17"']) {
      expect(echoed).not.toContain(tampered);
    }
  });

  it("charges the price at the moment of payment, not the one the buyer saw earlier", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { price: "50000.00" });

    await testDb.item.update({ where: { id: item.id }, data: { listedPrice: "30000.00" } });
    await accepted([item.id]);

    const order = await testDb.order.findFirstOrThrow({ where: { itemId: item.id } });
    expect(order.depositAmount.toString()).toBe("3000");
  });
});

describe("re-validation at checkout", () => {
  it("rejects an item that left 'listed' after it was added, with a conflict", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { status: "sold" });

    const { status, body } = await accepted([item.id]);

    expect(status).toBe(409);
    expect(body.unavailable).toEqual([{ id: item.id, reason: "Sold" }]);
    expect(await testDb.order.count()).toBe(0);
  });

  it("creates no orders at all when one item in the cart is unavailable", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const a = await makeItem(seller.id);
    const b = await makeItem(seller.id, { status: "on_hold" });
    const c = await makeItem(seller.id);

    const { status, body } = await accepted([a.id, b.id, c.id]);

    expect(status).toBe(409);
    expect(body.unavailable.map((u: { id: string }) => u.id)).toEqual([b.id]);
    expect(await testDb.order.count()).toBe(0);

    // The available items were rolled back to the marketplace, not left on hold.
    const statuses = await testDb.item.findMany({
      where: { id: { in: [a.id, c.id] } },
      select: { status: true },
    });
    expect(statuses.every((s) => s.status === "listed")).toBe(true);
  });

  it("reports an item deleted from the database as unavailable rather than crashing", async () => {
    await demoBuyer();

    const { status, body } = await accepted(["never-existed"]);

    expect(status).toBe(409);
    expect(body.unavailable).toEqual([{ id: "never-existed", reason: "No longer listed" }]);
  });

  it("accepts an item whose previous hold has lapsed", async () => {
    await demoBuyer();
    const other = await makeUser("buyer");
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { status: "on_hold" });
    await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: other.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        status: "deposit_paid",
        holdExpiresAt: new Date(Date.now() - HOUR),
      },
    });

    const { status } = await accepted([item.id]);

    expect(status).toBe(201);
    expect(await testDb.order.count({ where: { status: "deposit_paid" } })).toBe(1);
    expect(await testDb.order.count({ where: { status: "expired" } })).toBe(1);
  });
});

describe("one active order per item", () => {
  it("lets exactly one of two concurrent deposits win, and the other gets a conflict", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);

    const results = await Promise.all([accepted([item.id]), accepted([item.id])]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409]);
    expect(await testDb.order.count({ where: { itemId: item.id } })).toBe(1);
  });

  it("turns a violation of the database constraint into a conflict, not a server error", async () => {
    // An inconsistent row the application would never write: the item still
    // reads 'listed' but already has an active order. Only the partial unique
    // index stands between this and a second order.
    await demoBuyer();
    const other = await makeUser("buyer");
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);
    await testDb.order.create({
      data: {
        itemId: item.id,
        buyerId: other.id,
        depositAmount: "5000.00",
        balanceAmount: "45000.00",
        status: "deposit_paid",
        holdExpiresAt: new Date(Date.now() + 72 * HOUR),
      },
    });

    const { status, body } = await accepted([item.id]);

    expect(status).toBe(409);
    expect(body.unavailable).toEqual([{ id: item.id, reason: "Reserved by another buyer" }]);
    expect(await testDb.order.count({ where: { itemId: item.id } })).toBe(1);
  });
});

describe("validation at the boundary", () => {
  it("refuses an empty cart with an explanation and creates no order", async () => {
    await demoBuyer();

    const { status, body } = await accepted([]);

    expect(status).toBe(400);
    expect(body.error).toMatch(/cart is empty/i);
    expect(await testDb.order.count()).toBe(0);
  });

  it("refuses a checkout where the refund terms were not accepted", async () => {
    await demoBuyer();
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);

    for (const payload of [{ itemIds: [item.id] }, { itemIds: [item.id], acceptedTerms: false }]) {
      const { status } = await checkout(payload);
      expect(status).toBe(400);
    }
    expect(await testDb.order.count()).toBe(0);
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/checkout", { method: "POST", body: "nonsense" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects identifiers that are not strings, and a cart over the cap", async () => {
    await demoBuyer();
    expect((await accepted([1, 2])).status).toBe(400);
    expect((await accepted(Array.from({ length: 51 }, (_, i) => `item-${i}`))).status).toBe(400);
  });
});
