/**
 * GET /api/items, at the route-handler seam.
 *
 * This is where the catalogue's guarantees actually live: a query string can
 * narrow the result but never widen it past listed items, and malformed input
 * is refused before it reaches a query.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";
import { get } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { GET } = await import("@/app/api/items/route");
const call = (query: Record<string, string> = {}) => get(GET, "/api/items", query);

describe("what the catalogue returns", () => {
  it("returns listed items with their derived prices", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { title: "For sale", price: "50000.00" });

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.items[0].title).toBe("For sale");
    expect(body.items[0].deposit).toBe("5000");
    expect(body.items[0].balance).toBe("45000");
  });

  it("includes each item's images, lowest sortOrder first", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { images: 3 });

    const { body } = await call();

    expect(body.items[0].images.map((i: { sortOrder: number }) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it.each(["pending_review", "rejected", "on_hold", "sold", "completed"] as const)(
    "never returns a %s item",
    async (status) => {
      const seller = await makeUser("seller");
      await makeItem(seller.id, { status });

      const { body } = await call();

      expect(body.count).toBe(0);
    },
  );

  it("returns an empty list rather than an error when nothing matches", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { category: "books" });

    const { status, body } = await call({ category: "fashion" });

    expect(status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.count).toBe(0);
  });
});

describe("category filter", () => {
  it("narrows to one category", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { category: "books", title: "A book" });
    await makeItem(seller.id, { category: "fashion", title: "A coat" });

    const { body } = await call({ category: "books" });

    expect(body.count).toBe(1);
    expect(body.items[0].title).toBe("A book");
  });

  it("treats 'all' as no filter", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { category: "books" });
    await makeItem(seller.id, { category: "fashion" });

    const { body } = await call({ category: "all" });

    expect(body.count).toBe(2);
  });

  it("cannot be used to widen past listed items", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { category: "books", status: "sold" });

    const { body } = await call({ category: "books" });

    expect(body.count).toBe(0);
  });
});

describe("sorting", () => {
  async function threePrices() {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { title: "mid", price: "50000.00" });
    await makeItem(seller.id, { title: "cheap", price: "9000.00" });
    await makeItem(seller.id, { title: "dear", price: "120000.00" });
  }

  it("sorts by price ascending", async () => {
    await threePrices();
    const { body } = await call({ sort: "price_asc" });
    expect(body.items.map((i: { title: string }) => i.title)).toEqual(["cheap", "mid", "dear"]);
  });

  it("sorts by price descending", async () => {
    await threePrices();
    const { body } = await call({ sort: "price_desc" });
    expect(body.items.map((i: { title: string }) => i.title)).toEqual(["dear", "mid", "cheap"]);
  });

  it("defaults to newest when no sort is given", async () => {
    await threePrices();
    const { body } = await call();
    expect(body.query.sort).toBe("newest");
  });

  it("keeps the status filter under every sort", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { status: "sold", price: "1.00" });
    await makeItem(seller.id, { status: "listed", price: "2.00" });

    for (const sort of ["newest", "price_asc", "price_desc"]) {
      const { body } = await call({ sort });
      expect(body.count).toBe(1);
    }
  });
});

describe("validation at the boundary", () => {
  it("rejects an unknown category with 400", async () => {
    const { status, body } = await call({ category: "weapons" });

    expect(status).toBe(400);
    expect(body.error).toBe("Invalid query");
    expect(body.details[0].field).toBe("category");
  });

  it("rejects an unknown sort with 400", async () => {
    const { status } = await call({ sort: "cheapest_ever" });
    expect(status).toBe(400);
  });

  it("refuses injection attempts in the category rather than passing them through", async () => {
    const attempts = [
      "books' OR '1'='1",
      "books; DROP TABLE items;--",
      "../../etc/passwd",
      "<script>alert(1)</script>",
    ];

    for (const category of attempts) {
      const { status } = await call({ category });
      expect(status).toBe(400);
    }

    // And nothing was destroyed on the way through.
    expect(await testDb.item.count()).toBe(0);
  });

  it("does not leak internals in the error body", async () => {
    const { body } = await call({ category: "weapons" });
    const serialised = JSON.stringify(body);

    expect(serialised).not.toContain("prisma");
    expect(serialised).not.toContain("SELECT");
  });
});

describe("hold expiry on read", () => {
  it("brings an item with a lapsed hold back into the catalogue", async () => {
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

    const { body } = await call();

    expect(body.count).toBe(1);
    expect(body.items[0].id).toBe(item.id);
  });
});
