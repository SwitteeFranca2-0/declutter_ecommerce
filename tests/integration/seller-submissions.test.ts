/**
 * The seller's own submissions, at the database seam. SELL-2.
 *
 * The list is the first screen whose contents depend on who is looking, so the
 * scoping is the thing worth testing: a seller sees their own items and has no
 * way to reach anybody else's.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { getSellerSubmissions } = await import("@/lib/listings");

describe("getSellerSubmissions", () => {
  it("returns only this seller's items", async () => {
    const seller = await makeUser("seller");
    const other = await makeUser("seller");
    const mine = await makeItem(seller.id, { title: "Mine", status: "pending_review" });
    await makeItem(other.id, { title: "Theirs", status: "pending_review" });

    const rows = await getSellerSubmissions(seller.id);

    expect(rows.map((row) => row.title)).toEqual(["Mine"]);
    expect(rows[0].id).toBe(mine.id);
  });

  it("returns every status, including items that have left the marketplace", async () => {
    const seller = await makeUser("seller");
    for (const status of ["pending_review", "rejected", "listed", "on_hold", "sold"] as const) {
      await makeItem(seller.id, { status, title: status });
    }

    const rows = await getSellerSubmissions(seller.id);

    expect(rows.map((row) => row.status).sort()).toEqual(
      ["listed", "on_hold", "pending_review", "rejected", "sold"].sort(),
    );
  });

  it("puts the newest submission first", async () => {
    const seller = await makeUser("seller");
    const first = await makeItem(seller.id, { title: "first" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await makeItem(seller.id, { title: "second" });

    const rows = await getSellerSubmissions(seller.id);

    expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
  });

  it("carries the thumbnail, which is the lowest sortOrder image", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { images: 3 });

    const [row] = await getSellerSubmissions(seller.id);

    expect(row.thumbnail).toBe("/seed/test-1.svg");
  });

  it("shows the rejection reason when there is one", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { status: "rejected" });
    await testDb.item.update({
      where: { id: item.id },
      data: { rejectionReason: "Photographs too dark to judge condition" },
    });

    const [row] = await getSellerSubmissions(seller.id);

    expect(row.rejectionReason).toBe("Photographs too dark to judge condition");
  });

  it("returns nothing for a seller who has submitted nothing", async () => {
    const seller = await makeUser("seller");

    expect(await getSellerSubmissions(seller.id)).toEqual([]);
  });
});

describe("the requested payout and the public price", () => {
  it("hides the provisional price while the item is unpriced", async () => {
    const seller = await makeUser("seller");
    // A fresh submission: both columns hold the requested payout.
    await makeItem(seller.id, { status: "pending_review", price: "60000.00", payout: "60000.00" });

    const [row] = await getSellerSubmissions(seller.id);

    expect(row.requestedPayout).toBe("60000");
    expect(row.listedPrice).toBeNull();
  });

  it("shows both once an admin has priced it, so the margin is visible", async () => {
    const seller = await makeUser("seller");
    await makeItem(seller.id, { status: "listed", price: "72000.00", payout: "60000.00" });

    const [row] = await getSellerSubmissions(seller.id);

    expect(row.requestedPayout).toBe("60000");
    expect(row.listedPrice).toBe("72000");
  });
});
