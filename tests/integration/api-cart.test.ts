/**
 * POST /api/cart, at the route-handler seam.
 *
 * This is where BUY-6 lives: the cart holds identifiers, so availability and
 * every figure the buyer sees are resolved here against current rows.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";
import { postJson } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { POST } = await import("@/app/api/cart/route");
const cart = (itemIds: unknown) => postJson(POST, "/api/cart", { itemIds });

async function reserve(itemId: string) {
  const buyer = await makeUser("buyer");
  await testDb.item.update({ where: { id: itemId }, data: { status: "on_hold" } });
  await testDb.order.create({
    data: {
      itemId,
      buyerId: buyer.id,
      depositAmount: "5000.00",
      balanceAmount: "45000.00",
      status: "deposit_paid",
      holdExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    },
  });
}

describe("an empty cart", () => {
  it("returns zeroes rather than an error", async () => {
    const { status, body } = await cart([]);
    expect(status).toBe(200);
    expect(body.lines).toEqual([]);
    expect(body.availableCount).toBe(0);
    expect(body.depositTotal).toBe("0");
  });
});

describe("prices are read fresh", () => {
  it("returns the current price, not the one from when the item was added", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { price: "50000.00" });

    // An admin re-prices it after the buyer added it.
    await testDb.item.update({ where: { id: item.id }, data: { listedPrice: "40000.00" } });

    const { body } = await cart([item.id]);

    expect(body.lines[0].listedPrice).toBe("40000");
    expect(body.lines[0].deposit).toBe("4000");
    expect(body.priceTotal).toBe("40000");
  });

  it("derives deposit and balance server-side for every line", async () => {
    const seller = await makeUser("seller");
    const a = await makeItem(seller.id, { price: "50000.00" });
    const b = await makeItem(seller.id, { price: "9500.00" });

    const { body } = await cart([a.id, b.id]);

    expect(body.depositTotal).toBe("5950");
    expect(body.balanceTotal).toBe("53550");
    expect(body.priceTotal).toBe("59500");
  });

  it("keeps deposit plus balance equal to the price total", async () => {
    const seller = await makeUser("seller");
    const a = await makeItem(seller.id, { price: "9505.00" });
    const b = await makeItem(seller.id, { price: "33333.33" });

    const { body } = await cart([a.id, b.id]);

    const sum = Number(body.depositTotal) + Number(body.balanceTotal);
    expect(sum).toBe(Number(body.priceTotal));
  });
});

describe("unavailable items, BUY-6", () => {
  it("marks an item reserved by another buyer", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);
    await reserve(item.id);

    const { body } = await cart([item.id]);

    expect(body.lines[0].available).toBe(false);
    expect(body.lines[0].unavailableReason).toBe("Reserved by another buyer");
    expect(body.unavailableCount).toBe(1);
  });

  it.each([
    ["sold", "Sold"],
    ["completed", "Sold"],
    ["rejected", "No longer listed"],
    ["pending_review", "No longer listed"],
  ] as const)("marks a %s item unavailable", async (status, reason) => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { status });

    const { body } = await cart([item.id]);

    expect(body.lines[0].available).toBe(false);
    expect(body.lines[0].unavailableReason).toBe(reason);
  });

  it("excludes unavailable items from every total", async () => {
    const seller = await makeUser("seller");
    const good = await makeItem(seller.id, { price: "50000.00" });
    const gone = await makeItem(seller.id, { price: "80000.00" });
    await reserve(gone.id);

    const { body } = await cart([good.id, gone.id]);

    expect(body.availableCount).toBe(1);
    expect(body.unavailableCount).toBe(1);
    // The 80,000 item contributes nothing.
    expect(body.priceTotal).toBe("50000");
    expect(body.depositTotal).toBe("5000");
  });

  it("still shows the unavailable line, so the buyer can see and remove it", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { title: "Gone to someone else" });
    await reserve(item.id);

    const { body } = await cart([item.id]);

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].title).toBe("Gone to someone else");
  });

  it("makes an item available again once its hold lapses", async () => {
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
        holdExpiresAt: new Date(Date.now() - 3600 * 1000),
      },
    });

    const { body } = await cart([item.id]);

    expect(body.lines[0].available).toBe(true);
    expect(body.availableCount).toBe(1);
  });
});

describe("an item deleted from the database", () => {
  it("renders a line instead of crashing", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id);
    await testDb.item.delete({ where: { id: item.id } });

    const { status, body } = await cart([item.id]);

    expect(status).toBe(200);
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].available).toBe(false);
    expect(body.lines[0].listedPrice).toBeNull();
  });

  it("does not let a missing item break the rest of the cart", async () => {
    const seller = await makeUser("seller");
    const good = await makeItem(seller.id, { price: "50000.00" });

    const { body } = await cart([good.id, "never-existed"]);

    expect(body.availableCount).toBe(1);
    expect(body.priceTotal).toBe("50000");
  });
});

describe("ordering", () => {
  it("returns lines in the order the buyer added them, not database order", async () => {
    const seller = await makeUser("seller");
    const first = await makeItem(seller.id, { title: "first" });
    const second = await makeItem(seller.id, { title: "second" });
    const third = await makeItem(seller.id, { title: "third" });

    const { body } = await cart([third.id, first.id, second.id]);

    expect(body.lines.map((l: { title: string }) => l.title)).toEqual([
      "third",
      "first",
      "second",
    ]);
  });
});

describe("validation at the boundary", () => {
  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/cart", { method: "POST", body: "nonsense" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects itemIds that is not an array", async () => {
    const { status } = await cart("item-1");
    expect(status).toBe(400);
  });

  it("rejects a cart larger than the cap", async () => {
    const { status } = await cart(Array.from({ length: 51 }, (_, i) => `item-${i}`));
    expect(status).toBe(400);
  });

  it("rejects entries that are not strings", async () => {
    const { status } = await cart([1, 2, 3]);
    expect(status).toBe(400);
  });

  it("refuses injection attempts rather than passing them through", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id);

    const { status, body } = await cart(["' OR 1=1 --", "'; DROP TABLE items;--"]);

    // Well-formed strings, so they parse, but they match nothing and destroy
    // nothing: Prisma parameterises, it does not interpolate.
    expect(status).toBe(200);
    expect(body.availableCount).toBe(0);
    expect(await testDb.item.count()).toBe(1);
  });

  it("does not leak internals in the error body", async () => {
    const { body } = await cart("not-an-array");
    expect(JSON.stringify(body)).not.toContain("prisma");
  });
});
