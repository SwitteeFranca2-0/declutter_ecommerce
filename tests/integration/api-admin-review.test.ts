/**
 * POST /api/admin/items/[id]/review — ADMIN-1 to ADMIN-4.
 *
 * The slice's central invariant lives here: the listed price is checked
 * against the payout *stored on the row*, never a figure the request supplies.
 * An admin who could send their own payout could publish an item at a loss, so
 * the tampering case is tested explicitly rather than assumed.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/admin/items/[id]/review/route";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";
import { postJson } from "../helpers/request";

let admin: Awaited<ReturnType<typeof makeUser>>;
let seller: Awaited<ReturnType<typeof makeUser>>;

const review = (id: string, payload: unknown, as: { email: string } | null) =>
  postJson(POST, `/api/admin/items/${id}/review`, payload, { as, params: { id } });

beforeAll(async () => {
  await resetDb();
});

beforeEach(async () => {
  await resetDb();
  admin = await makeUser("admin");
  seller = await makeUser("seller");
});

describe("approving a submission", () => {
  it("publishes the item at the admin's price and leaves the payout alone", async () => {
    const item = await makeItem(seller.id, {
      status: "pending_review",
      payout: "40000.00",
      price: "40000.00",
    });

    const { status, body } = await review(
      item.id,
      { decision: "approve", title: item.title, description: "A tidy description.", listedPrice: "52000" },
      admin,
    );

    expect(status).toBe(200);
    expect(body.item.status).toBe("listed");

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("listed");
    expect(stored.listedPrice.toString()).toBe("52000");
    // The payout obligation is never touched by pricing.
    expect(stored.sellerPayoutAmount.toString()).toBe("40000");
    // ADMIN-2: an audit trail of who published it.
    expect(stored.approvedById).toBe(admin.id);
  });

  it("stores the admin's edits to the title and description (ADMIN-3)", async () => {
    const item = await makeItem(seller.id, { status: "pending_review", title: "big tv", payout: "30000.00" });

    await review(
      item.id,
      {
        decision: "approve",
        title: "Samsung 43-inch television",
        description: "Working 43-inch television, one owner, original remote included.",
        listedPrice: "45000",
      },
      admin,
    );

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.title).toBe("Samsung 43-inch television");
    expect(stored.description).toContain("original remote");
  });

  it("refuses a price at or below the seller's payout", async () => {
    const item = await makeItem(seller.id, { status: "pending_review", payout: "40000.00" });

    for (const listedPrice of ["40000", "39999.99", "1"]) {
      const { status, body } = await review(
        item.id,
        { decision: "approve", title: item.title, description: item.description, listedPrice },
        admin,
      );

      expect(status).toBe(400);
      expect(JSON.stringify(body.details)).toContain("listedPrice");
    }

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("pending_review");
  });

  it("checks the price against the stored payout, not one supplied by the request", async () => {
    const item = await makeItem(seller.id, { status: "pending_review", payout: "40000.00" });

    const { status } = await review(
      item.id,
      {
        decision: "approve",
        title: item.title,
        description: item.description,
        listedPrice: "10000",
        // Ignored entirely: the payout is whatever the row says.
        sellerPayoutAmount: "500",
        status: "listed",
      },
      admin,
    );

    expect(status).toBe(400);

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.sellerPayoutAmount.toString()).toBe("40000");
    expect(stored.status).toBe("pending_review");
  });

  it.each([
    ["empty", ""],
    ["negative", "-5000"],
    ["lettered", "50000n"],
    ["too many decimal places", "50000.005"],
  ])("refuses a %s price at the boundary", async (_label, listedPrice) => {
    const item = await makeItem(seller.id, { status: "pending_review", payout: "40000.00" });

    const { status } = await review(
      item.id,
      { decision: "approve", title: item.title, description: item.description, listedPrice },
      admin,
    );

    expect(status).toBe(400);
  });
});

describe("rejecting a submission", () => {
  it("records the reason and makes the decision terminal", async () => {
    const item = await makeItem(seller.id, { status: "pending_review" });

    const { status } = await review(
      item.id,
      { decision: "reject", reason: "The photographs do not show the item described." },
      admin,
    );

    expect(status).toBe(200);

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("rejected");
    expect(stored.rejectionReason).toBe("The photographs do not show the item described.");

    // `rejected` is terminal (PRD §8): a second decision cannot revive it.
    const second = await review(
      item.id,
      { decision: "approve", title: item.title, description: item.description, listedPrice: "90000" },
      admin,
    );

    expect(second.status).toBe(409);
    const after = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.status).toBe("rejected");
  });

  it("refuses a rejection with no reason", async () => {
    const item = await makeItem(seller.id, { status: "pending_review" });

    for (const reason of ["", "   "]) {
      const { status } = await review(item.id, { decision: "reject", reason }, admin);
      expect(status).toBe(400);
    }

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("pending_review");
  });
});

describe("guards and races", () => {
  it("refuses a signed-out request with 401 and a non-admin with 403 (AUTH-6)", async () => {
    const item = await makeItem(seller.id, { status: "pending_review" });
    const buyer = await makeUser("buyer");
    const payload = {
      decision: "approve",
      title: item.title,
      description: item.description,
      listedPrice: "90000",
    };

    expect((await review(item.id, payload, null)).status).toBe(401);
    expect((await review(item.id, payload, buyer)).status).toBe(403);
    expect((await review(item.id, payload, seller)).status).toBe(403);

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("pending_review");
  });

  it("refuses to re-decide an item another admin already published", async () => {
    const item = await makeItem(seller.id, { status: "listed", payout: "40000.00", price: "60000.00" });

    const { status } = await review(
      item.id,
      { decision: "approve", title: item.title, description: item.description, listedPrice: "99000" },
      admin,
    );

    expect(status).toBe(409);

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.listedPrice.toString()).toBe("60000");
  });

  it("returns 404 for an item that does not exist", async () => {
    const { status } = await review(
      "does-not-exist",
      { decision: "reject", reason: "Nothing here." },
      admin,
    );

    expect(status).toBe(404);
  });

  it("lets only one of two simultaneous approvals win", async () => {
    const item = await makeItem(seller.id, { status: "pending_review", payout: "40000.00" });
    const payload = (listedPrice: string) => ({
      decision: "approve" as const,
      title: item.title,
      description: item.description,
      listedPrice,
    });

    const [first, second] = await Promise.all([
      review(item.id, payload("50000"), admin),
      review(item.id, payload("70000"), admin),
    ]);

    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual([200, 409]);

    const stored = await testDb.item.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.status).toBe("listed");
    expect(["50000", "70000"]).toContain(stored.listedPrice.toString());
  });
});
