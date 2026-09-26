/**
 * The deposit opening a direct thread, at the route-handler seam.
 *
 * MSG-3, BUY-8, BUY-9. Paying the deposit is the moment commitment becomes
 * real: the two parties start talking to each other rather than through the
 * admin, and the buyer receives the seller's contact details.
 *
 * The asymmetry is deliberate and is asserted in both directions: the buyer
 * gets the seller's name and phone, the seller never gets the buyer's.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";
import { get, postJson } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { POST: checkout } = await import("@/app/api/checkout/route");
const { POST: sendMessage } = await import("@/app/api/threads/route");
const { GET: readThread } = await import("@/app/api/threads/[id]/route");
const { GET: readOrder } = await import("@/app/api/orders/[id]/route");

type As = { email: string } | null;

const pay = (itemIds: string[], as: As) =>
  postJson(checkout, "/api/checkout", { itemIds, acceptedTerms: true }, { as });

const readThreadAs = (threadId: string, as: As) =>
  get(
    (request: Request) => readThread(request, { params: Promise.resolve({ id: threadId }) }),
    `/api/threads/${threadId}`,
    {},
    { as },
  );

const readOrderAs = (orderId: string, as: As) =>
  get(
    (request: Request) => readOrder(request, { params: Promise.resolve({ id: orderId }) }),
    `/api/orders/${orderId}`,
    {},
    { as },
  );

const post = (threadId: string, body: string, as: As) =>
  postJson(sendMessage, "/api/threads", { threadId, body }, { as });

async function cast() {
  const admin = await makeUser("admin", { email: "admin@test.local" });
  const seller = await makeUser("seller", { email: "seller@test.local", firstName: "Sade" });
  const buyer = await makeUser("buyer", { email: "buyer@test.local", firstName: "Chidi" });
  const item = await makeItem(seller.id, { title: "Yamaha guitar", price: "50000.00" });

  return { admin, seller, buyer, item };
}

describe("the deposit opens a direct thread, MSG-3", () => {
  it("creates one direct thread for the order", async () => {
    const { buyer, item } = await cast();

    await pay([item.id], { email: buyer.email });

    const order = await testDb.order.findFirstOrThrow();
    const threads = await testDb.thread.findMany();

    expect(threads).toHaveLength(1);
    expect(threads[0].threadType).toBe("direct");
    expect(threads[0].orderId).toBe(order.id);
    expect(threads[0].itemId).toBe(item.id);
    expect(threads[0].buyerId).toBe(buyer.id);
    expect(threads[0].status).toBe("open");
  });

  it("gives a three-item cart three separate conversations", async () => {
    const { buyer, seller } = await cast();
    const a = await makeItem(seller.id);
    const b = await makeItem(seller.id);
    const c = await makeItem(seller.id);

    await pay([a.id, b.id, c.id], { email: buyer.email });

    const threads = await testDb.thread.findMany();
    expect(threads).toHaveLength(3);
    expect(new Set(threads.map((t) => t.orderId)).size).toBe(3);
  });

  it("creates no thread at all when the checkout is refused", async () => {
    const { buyer, seller, item } = await cast();
    const gone = await makeItem(seller.id, { status: "sold" });

    const { status } = await pay([item.id, gone.id], { email: buyer.email });

    expect(status).toBe(409);
    expect(await testDb.order.count()).toBe(0);
    expect(await testDb.thread.count()).toBe(0);
  });

  it("stores a direct message visible to both, with no moderation step", async () => {
    const { buyer, seller, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    const { status } = await post(thread.id, "Can I collect on Saturday?", {
      email: buyer.email,
    });

    expect(status).toBe(201);
    const message = await testDb.message.findFirstOrThrow();
    expect(message.visibleTo).toBe("both");

    // The seller sees it immediately: nothing is waiting on the admin.
    const sellerView = await readThreadAs(thread.id, { email: seller.email });
    expect(JSON.stringify(sellerView.body)).toContain("Can I collect on Saturday?");
  });

  it("lets both parties see each other's first names", async () => {
    const { buyer, seller, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    await post(thread.id, "From the buyer", { email: buyer.email });
    await post(thread.id, "From the seller", { email: seller.email });

    const asSeller = await readThreadAs(thread.id, { email: seller.email });
    const asBuyer = await readThreadAs(thread.id, { email: buyer.email });

    expect(JSON.stringify(asSeller.body)).toContain("Chidi");
    expect(JSON.stringify(asBuyer.body)).toContain("Sade");
  });
});

describe("the relay thread is closed, not lost", () => {
  it("locks the buyer's relay thread for that item, with a reason", async () => {
    const { buyer, item } = await cast();
    const relay = await testDb.thread.create({
      data: { itemId: item.id, buyerId: buyer.id, threadType: "relay", status: "open" },
    });
    await testDb.message.create({
      data: { threadId: relay.id, senderId: buyer.id, body: "Earlier question", visibleTo: "both" },
    });

    await pay([item.id], { email: buyer.email });

    const after = await testDb.thread.findUniqueOrThrow({ where: { id: relay.id } });
    expect(after.status).toBe("locked");
    expect(after.lockedReason).toMatch(/direct/i);
    expect(after.lockedAt).not.toBeNull();
  });

  it("keeps the earlier conversation readable", async () => {
    const { buyer, item } = await cast();
    const relay = await testDb.thread.create({
      data: { itemId: item.id, buyerId: buyer.id, threadType: "relay", status: "open" },
    });
    await testDb.message.create({
      data: { threadId: relay.id, senderId: buyer.id, body: "Earlier question", visibleTo: "both" },
    });

    await pay([item.id], { email: buyer.email });

    const { status, body } = await readThreadAs(relay.id, { email: buyer.email });
    expect(status).toBe(200);
    expect(JSON.stringify(body)).toContain("Earlier question");
  });

  it("refuses a new message to the closed relay thread", async () => {
    const { buyer, item } = await cast();
    const relay = await testDb.thread.create({
      data: { itemId: item.id, buyerId: buyer.id, threadType: "relay", status: "open" },
    });

    await pay([item.id], { email: buyer.email });
    const { status } = await post(relay.id, "Still here?", { email: buyer.email });

    expect(status).toBe(409);
  });

  it("leaves another buyer's relay thread about the same item untouched", async () => {
    const { buyer, item } = await cast();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });
    const theirs = await testDb.thread.create({
      data: { itemId: item.id, buyerId: other.id, threadType: "relay", status: "open" },
    });

    await pay([item.id], { email: buyer.email });

    const after = await testDb.thread.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(after.status).toBe("open");
  });
});

describe("contact details, BUY-8", () => {
  it("gives the buyer the seller's name and phone on their order", async () => {
    const { buyer, seller, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const order = await testDb.order.findFirstOrThrow();

    const { status, body } = await readOrderAs(order.id, { email: buyer.email });

    expect(status).toBe(200);
    expect(body.seller.firstName).toBe("Sade");
    expect(body.seller.phone).toBe(seller.phone);
    expect(body.balanceAmount).toBe("45000");
    expect(body.depositAmount).toBe("5000");
  });

  it("never gives the seller the buyer's phone or email", async () => {
    const { buyer, seller, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    await post(thread.id, "Hello from the buyer", { email: buyer.email });

    const { body } = await readThreadAs(thread.id, { email: seller.email });

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(buyer.phone);
    expect(serialised).not.toContain(buyer.email);
    // The first name is deliberate: the conversation reads like one between people.
    expect(serialised).toContain("Chidi");
  });

  it("shows no seller contact details anywhere before a deposit exists", async () => {
    const { buyer, seller, item } = await cast();

    const { getListedItem } = await import("@/lib/items");
    const detail = await getListedItem(item.id);

    const serialised = JSON.stringify(detail);
    expect(serialised).not.toContain(seller.phone);
    expect(serialised).not.toContain(seller.firstName);
    expect(serialised).not.toContain(seller.email);
    expect(buyer.id).toBeTruthy();
  });

  it("refuses the order to a buyer who did not place it", async () => {
    const { buyer, item } = await cast();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });
    await pay([item.id], { email: buyer.email });
    const order = await testDb.order.findFirstOrThrow();

    const { status } = await readOrderAs(order.id, { email: other.email });

    expect(status).toBe(404);
  });

  it("refuses the order to a signed-out visitor", async () => {
    const { buyer, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const order = await testDb.order.findFirstOrThrow();

    expect((await readOrderAs(order.id, null)).status).toBe(401);
  });

  it("lets the seller read the order without the buyer's contact details", async () => {
    const { buyer, seller, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const order = await testDb.order.findFirstOrThrow();

    const { status, body } = await readOrderAs(order.id, { email: seller.email });

    expect(status).toBe(200);
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(buyer.phone);
    expect(serialised).not.toContain(buyer.email);
  });
});

describe("the direct thread's guards", () => {
  it("refuses a stranger with 404", async () => {
    const { buyer, item } = await cast();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });
    await pay([item.id], { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    expect((await readThreadAs(thread.id, { email: other.email })).status).toBe(404);
    expect((await post(thread.id, "Butting in", { email: other.email })).status).toBe(404);
  });

  it("gives the admin the whole conversation, MSG-7", async () => {
    const { admin, buyer, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    await post(thread.id, "Arranging collection", { email: buyer.email });

    const { status, body } = await readThreadAs(thread.id, { email: admin.email });

    expect(status).toBe(200);
    expect(JSON.stringify(body)).toContain("Arranging collection");
  });

  it("keeps the conversation readable after the hold lapses", async () => {
    const { buyer, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    await post(thread.id, "Are we still on?", { email: buyer.email });

    // Push the hold into the past and let a read release it.
    await testDb.order.updateMany({ data: { holdExpiresAt: new Date(Date.now() - 3600_000) } });
    const { releaseLapsedHolds } = await import("@/lib/items");
    await releaseLapsedHolds();

    const { status, body } = await readThreadAs(thread.id, { email: buyer.email });

    expect(status).toBe(200);
    expect(JSON.stringify(body)).toContain("Are we still on?");
  });

  it("stores a hostile message verbatim, T-XSS", async () => {
    const { buyer, item } = await cast();
    await pay([item.id], { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    const hostile = '<script>alert("xss")</script>';

    await post(thread.id, hostile, { email: buyer.email });

    const message = await testDb.message.findFirstOrThrow();
    expect(message.body).toBe(hostile);
  });
});
