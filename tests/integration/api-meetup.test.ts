/**
 * Agreeing a meetup point, at the route-handler seam.
 *
 * LOC-1, LOC-2, §14.7. One party proposes a point, the other accepts, and the
 * agreement is written to the order so it becomes a fact the rest of the
 * system can use rather than a sentence in a conversation.
 *
 * The shape that matters: a proposal is not an agreement. A single stored
 * point could not tell a suggestion from a decision, and that difference is
 * the whole meaning of "agree a meetup point".
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";
import { postJson } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { POST: checkout } = await import("@/app/api/checkout/route");
const { POST: meetup } = await import("@/app/api/orders/[id]/meetup/route");

type As = { email: string } | null;

/** Ikeja City Mall, a public place in the catalogue's city. */
const POINT = { lat: 6.6018, lng: 3.3515, label: "Ikeja City Mall, main entrance" };

const propose = (orderId: string, as: As, body: Record<string, unknown> = POINT) =>
  postJson(
    (request: Request) => meetup(request, { params: Promise.resolve({ id: orderId }) }),
    `/api/orders/${orderId}/meetup`,
    { action: "propose", ...body },
    { as },
  );

const accept = (orderId: string, as: As) =>
  postJson(
    (request: Request) => meetup(request, { params: Promise.resolve({ id: orderId }) }),
    `/api/orders/${orderId}/meetup`,
    { action: "accept" },
    { as },
  );

async function reservedOrder() {
  const admin = await makeUser("admin", { email: "admin@test.local" });
  const seller = await makeUser("seller", { email: "seller@test.local", firstName: "Sade" });
  const buyer = await makeUser("buyer", { email: "buyer@test.local", firstName: "Chidi" });
  const item = await makeItem(seller.id, { title: "Yamaha guitar" });

  await postJson(
    checkout,
    "/api/checkout",
    { itemIds: [item.id], acceptedTerms: true },
    { as: { email: buyer.email } },
  );

  const order = await testDb.order.findFirstOrThrow();
  const thread = await testDb.thread.findFirstOrThrow({ where: { threadType: "direct" } });

  return { admin, seller, buyer, item, order, thread };
}

describe("proposing a point, LOC-1", () => {
  it("writes the coordinates and label to the order", async () => {
    const { buyer, order } = await reservedOrder();

    const { status, body } = await propose(order.id, { email: buyer.email });

    expect(status).toBe(200);
    expect(body.meetup.agreed).toBe(false);

    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.meetupLat).toBeCloseTo(POINT.lat, 4);
    expect(after.meetupLng).toBeCloseTo(POINT.lng, 4);
    expect(after.meetupLabel).toBe(POINT.label);
  });

  it("lets the seller propose just as readily", async () => {
    const { seller, order } = await reservedOrder();

    const { status } = await propose(order.id, { email: seller.email });

    expect(status).toBe(200);
    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.meetupLabel).toBe(POINT.label);
  });

  it("appends one message to the direct thread, visible to both", async () => {
    const { buyer, order, thread } = await reservedOrder();

    await propose(order.id, { email: buyer.email });

    const messages = await testDb.message.findMany({ where: { threadId: thread.id } });
    expect(messages).toHaveLength(1);
    expect(messages[0].visibleTo).toBe("both");
    expect(messages[0].body).toContain(POINT.label);
    expect(messages[0].senderId).toBe(buyer.id);
  });

  it("replaces an earlier proposal and clears any agreement", async () => {
    const { buyer, seller, order } = await reservedOrder();
    await propose(order.id, { email: buyer.email });
    await accept(order.id, { email: seller.email });

    const elsewhere = { lat: 6.4531, lng: 3.3958, label: "Lekki Phase 1 roundabout" };
    const { body } = await propose(order.id, { email: seller.email }, elsewhere);

    expect(body.meetup.agreed).toBe(false);
    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.meetupLabel).toBe(elsewhere.label);
    expect(after.meetupLat).toBeCloseTo(elsewhere.lat, 4);
  });

  it("stores a hostile label verbatim, T-XSS", async () => {
    const { buyer, order } = await reservedOrder();
    const hostile = '<script>alert("xss")</script>';

    await propose(order.id, { email: buyer.email }, { ...POINT, label: hostile });

    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.meetupLabel).toBe(hostile);
  });
});

describe("accepting, LOC-2", () => {
  it("marks the point agreed when the other party accepts", async () => {
    const { buyer, seller, order } = await reservedOrder();
    await propose(order.id, { email: buyer.email });

    const { status, body } = await accept(order.id, { email: seller.email });

    expect(status).toBe(200);
    expect(body.meetup.agreed).toBe(true);
    expect(body.meetup.label).toBe(POINT.label);
  });

  it("refuses the proposer accepting their own proposal", async () => {
    const { buyer, order } = await reservedOrder();
    await propose(order.id, { email: buyer.email });

    const { status } = await accept(order.id, { email: buyer.email });

    expect(status).toBe(409);
  });

  it("refuses acceptance when nothing has been proposed", async () => {
    const { seller, order } = await reservedOrder();

    const { status } = await accept(order.id, { email: seller.email });

    expect(status).toBe(409);
  });

  it("appends an acceptance message to the thread", async () => {
    const { buyer, seller, order, thread } = await reservedOrder();
    await propose(order.id, { email: buyer.email });
    await accept(order.id, { email: seller.email });

    const messages = await testDb.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
    });
    expect(messages).toHaveLength(2);
    expect(messages[1].senderId).toBe(seller.id);
    expect(messages[1].body.toLowerCase()).toContain("agreed");
  });
});

describe("who may agree a meetup", () => {
  it("refuses a buyer who did not place the order", async () => {
    const { order } = await reservedOrder();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });

    expect((await propose(order.id, { email: other.email })).status).toBe(404);
    expect((await accept(order.id, { email: other.email })).status).toBe(404);
    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.meetupLabel).toBeNull();
  });

  it("refuses a seller who does not own the item", async () => {
    const { order } = await reservedOrder();
    const other = await makeUser("seller", { email: "other.seller@test.local" });

    expect((await propose(order.id, { email: other.email })).status).toBe(404);
  });

  it("refuses a signed-out request with 401", async () => {
    const { order } = await reservedOrder();

    expect((await propose(order.id, null)).status).toBe(401);
    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.meetupLabel).toBeNull();
  });

  it("refuses the admin proposing, since agreement is between the parties", async () => {
    const { admin, order } = await reservedOrder();

    const { status } = await propose(order.id, { email: admin.email });

    expect(status).toBe(403);
  });

  it("lets the admin read the agreed point, MSG-7", async () => {
    const { admin, buyer, seller, order } = await reservedOrder();
    await propose(order.id, { email: buyer.email });
    await accept(order.id, { email: seller.email });

    const { getOrderFor } = await import("@/lib/orders");
    const view = await getOrderFor(order.id, { id: admin.id, role: "admin" });

    expect(view?.meetup?.label).toBe(POINT.label);
    expect(view?.meetup?.agreed).toBe(true);
  });
});

describe("validation at the boundary", () => {
  it.each([
    ["a latitude out of range", { lat: 91, lng: 3.35, label: POINT.label }],
    ["a longitude out of range", { lat: 6.6, lng: 181, label: POINT.label }],
    ["coordinates that are not numbers", { lat: "here", lng: "there", label: POINT.label }],
    ["a missing latitude", { lng: 3.35, label: POINT.label }],
    ["an empty label", { ...POINT, label: "   " }],
    ["an over-long label", { ...POINT, label: "x".repeat(121) }],
  ])("refuses %s", async (_case, body) => {
    const { buyer, order } = await reservedOrder();

    const { status } = await propose(order.id, { email: buyer.email }, body);

    expect(status).toBe(400);
    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.meetupLabel).toBeNull();
  });

  it("refuses an unknown action", async () => {
    const { buyer, order } = await reservedOrder();

    const { status } = await postJson(
      (request: Request) => meetup(request, { params: Promise.resolve({ id: order.id }) }),
      `/api/orders/${order.id}/meetup`,
      { action: "cancel" },
      { as: { email: buyer.email } },
    );

    expect(status).toBe(400);
  });

  it("refuses a meetup on an order whose hold has lapsed", async () => {
    const { buyer, order } = await reservedOrder();
    await testDb.order.update({
      where: { id: order.id },
      data: { holdExpiresAt: new Date(Date.now() - 3600_000) },
    });

    const { status } = await propose(order.id, { email: buyer.email });

    expect(status).toBe(409);
  });
});
