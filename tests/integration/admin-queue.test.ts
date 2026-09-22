/**
 * The admin's review queue, at the database seam. ADMIN-1.
 *
 * Two things are worth testing here and the rest is rendering: the queue holds
 * exactly the submissions awaiting a decision and nothing else, and it is
 * ordered so that the longest wait is seen first.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { getReviewQueue, getSubmissionForReview } = await import("@/lib/review");

describe("getReviewQueue", () => {
  it("holds only submissions awaiting a decision", async () => {
    const seller = await makeUser("seller");
    const waiting = await makeItem(seller.id, { title: "Waiting", status: "pending_review" });

    for (const status of ["rejected", "listed", "on_hold", "sold", "completed"] as const) {
      await makeItem(seller.id, { title: status, status });
    }

    const rows = await getReviewQueue();

    expect(rows.map((row) => row.id)).toEqual([waiting.id]);
  });

  it("puts the longest wait first", async () => {
    const seller = await makeUser("seller");
    const first = await makeItem(seller.id, { title: "First", status: "pending_review" });
    const second = await makeItem(seller.id, { title: "Second", status: "pending_review" });

    // makeItem stamps createdAt with now(), so the wait is set explicitly
    // rather than by hoping two inserts land a measurable distance apart.
    await testDb.item.update({
      where: { id: first.id },
      data: { createdAt: new Date("2026-09-01T09:00:00Z") },
    });
    await testDb.item.update({
      where: { id: second.id },
      data: { createdAt: new Date("2026-09-15T09:00:00Z") },
    });

    const rows = await getReviewQueue();

    expect(rows.map((row) => row.title)).toEqual(["First", "Second"]);
  });

  it("carries what a row needs to be judged without opening it", async () => {
    const seller = await makeUser("seller", { firstName: "Ada" });
    await makeItem(seller.id, {
      title: "Standing lamp",
      status: "pending_review",
      category: "furniture",
      payout: "18000.00",
      images: 3,
    });

    const [row] = await getReviewQueue();

    expect(row.title).toBe("Standing lamp");
    expect(row.category).toBe("furniture");
    expect(row.condition).toBe("good");
    expect(row.requestedPayout).toBe("18000");
    expect(row.sellerName).toBe("Ada");
    expect(row.thumbnail).toBe("/seed/test-1.svg");
    expect(row.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("is empty when nothing is waiting", async () => {
    expect(await getReviewQueue()).toEqual([]);
  });
});

describe("getSubmissionForReview", () => {
  it("returns the whole submission, every photograph in order", async () => {
    const seller = await makeUser("seller");
    const item = await makeItem(seller.id, { status: "pending_review", images: 3, payout: "25000.00" });

    const found = await getSubmissionForReview(item.id);

    expect(found).not.toBeNull();
    expect(found?.description).toContain("realistic");
    expect(found?.requestedPayout).toBe("25000");
    expect(found?.images).toEqual([
      "/seed/test-1.svg",
      "/seed/test-2.svg",
      "/seed/test-3.svg",
    ]);
  });

  it("returns null for an item that is not awaiting review, so a decided item cannot be re-reviewed", async () => {
    const seller = await makeUser("seller");
    const listed = await makeItem(seller.id, { status: "listed" });
    const rejected = await makeItem(seller.id, { status: "rejected" });

    expect(await getSubmissionForReview(listed.id)).toBeNull();
    expect(await getSubmissionForReview(rejected.id)).toBeNull();
    expect(await getSubmissionForReview("does-not-exist")).toBeNull();
  });
});
