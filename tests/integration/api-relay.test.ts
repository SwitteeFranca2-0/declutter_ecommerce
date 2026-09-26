/**
 * The information request relay, at the route-handler seam.
 *
 * BUY-4, SELL-3, MSG-1, MSG-2, MSG-7. A buyer asks about an item, the admin
 * sees it unmasked and decides what is relayed, and the seller answers without
 * learning who asked.
 *
 * The masking tests assert on the **whole serialised response**, not on a
 * chosen field. Identity is dropped before the response leaves the server, so
 * a seller reading the network tab finds nothing, and a test that checked one
 * field would not prove that.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";
import { get, postJson } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { POST: ask } = await import("@/app/api/threads/route");
const { GET: readThread } = await import("@/app/api/threads/[id]/route");
const { POST: moderate } = await import("@/app/api/admin/messages/[id]/route");

type As = { email: string } | null;

const askAbout = (itemId: string, body: string, as: As) =>
  postJson(ask, "/api/threads", { itemId, body }, { as });

const readAs = (threadId: string, as: As, query: Record<string, string> = {}) =>
  get(
    (request: Request) => readThread(request, { params: Promise.resolve({ id: threadId }) }),
    `/api/threads/${threadId}`,
    query,
    { as },
  );

const replyTo = (threadId: string, body: string, as: As) =>
  postJson(ask, "/api/threads", { threadId, body }, { as });

const decide = (messageId: string, action: "relay" | "withhold", as: As) =>
  postJson(
    (request: Request) => moderate(request, { params: Promise.resolve({ id: messageId }) }),
    `/api/admin/messages/${messageId}`,
    { action },
    { as },
  );

async function cast() {
  const admin = await makeUser("admin", { email: "admin@test.local" });
  const seller = await makeUser("seller", { email: "seller@test.local", firstName: "Sade" });
  const buyer = await makeUser("buyer", { email: "buyer@test.local", firstName: "Chidi" });
  const item = await makeItem(seller.id, { title: "Yamaha guitar" });

  return { admin, seller, buyer, item };
}

describe("asking a question, BUY-4", () => {
  it("opens a relay thread owned by the buyer and stores the message", async () => {
    const { buyer, item } = await cast();

    const { status, body } = await askAbout(item.id, "Does it come with a case?", {
      email: buyer.email,
    });

    expect(status).toBe(201);
    expect(body.thread.id).toEqual(expect.any(String));

    const thread = await testDb.thread.findFirstOrThrow({ include: { messages: true } });
    expect(thread.threadType).toBe("relay");
    expect(thread.buyerId).toBe(buyer.id);
    expect(thread.itemId).toBe(item.id);
    expect(thread.orderId).toBeNull();
    expect(thread.status).toBe("open");
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0].body).toBe("Does it come with a case?");
    expect(thread.messages[0].senderId).toBe(buyer.id);
  });

  it("stores a buyer's message for the admin only, until it is relayed", async () => {
    const { buyer, item } = await cast();

    await askAbout(item.id, "Any scratches?", { email: buyer.email });

    const message = await testDb.message.findFirstOrThrow();
    expect(message.visibleTo).toBe("buyer_and_admin");
  });

  it("continues the same thread for a second question", async () => {
    const { buyer, item } = await cast();

    await askAbout(item.id, "First question", { email: buyer.email });
    const { status } = await askAbout(item.id, "Second question", { email: buyer.email });

    expect(status).toBe(201);
    expect(await testDb.thread.count()).toBe(1);
    expect(await testDb.message.count()).toBe(2);
  });

  it("gives two buyers two separate threads about the same item", async () => {
    const { buyer, item } = await cast();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });

    await askAbout(item.id, "From the first buyer", { email: buyer.email });
    await askAbout(item.id, "From the second buyer", { email: other.email });

    const threads = await testDb.thread.findMany();
    expect(threads).toHaveLength(2);
    expect(new Set(threads.map((t) => t.buyerId))).toEqual(new Set([buyer.id, other.id]));
  });

  it("lets exactly one of two simultaneous first questions open the thread", async () => {
    const { buyer, item } = await cast();

    const results = await Promise.all([
      askAbout(item.id, "One", { email: buyer.email }),
      askAbout(item.id, "Two", { email: buyer.email }),
    ]);

    // Either both messages land on one thread, or one loses cleanly. Never two
    // threads: that is the partial unique index doing its job.
    expect(await testDb.thread.count()).toBe(1);
    expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true);
  });

  it("refuses a question about an item that is not listed", async () => {
    const { buyer, seller } = await cast();
    const gone = await makeItem(seller.id, { status: "sold" });

    const { status } = await askAbout(gone.id, "Still available?", { email: buyer.email });

    expect(status).toBe(404);
    expect(await testDb.thread.count()).toBe(0);
  });

  it("refuses a signed-out question with 401 and an unverified buyer with 403", async () => {
    const { item } = await cast();
    const unverified = await makeUser("buyer", {
      email: "unverified@test.local",
      phoneVerified: false,
    });

    expect((await askAbout(item.id, "Hello", null)).status).toBe(401);
    expect((await askAbout(item.id, "Hello", { email: unverified.email })).status).toBe(403);
    expect(await testDb.thread.count()).toBe(0);
  });

  it.each([
    ["an empty body", ""],
    ["whitespace only", "   \n  "],
    ["an over-long body", "x".repeat(2001)],
  ])("refuses %s", async (_case, body) => {
    const { buyer, item } = await cast();

    const { status } = await askAbout(item.id, body, { email: buyer.email });

    expect(status).toBe(400);
    expect(await testDb.message.count()).toBe(0);
  });

  it("ignores a visibleTo supplied in the body", async () => {
    const { buyer, item } = await cast();

    await postJson(
      ask,
      "/api/threads",
      { itemId: item.id, body: "Sneaky", visibleTo: "both" },
      { as: { email: buyer.email } },
    );

    const message = await testDb.message.findFirstOrThrow();
    expect(message.visibleTo).toBe("buyer_and_admin");
  });

  it("stores a hostile body verbatim, T-XSS", async () => {
    const { buyer, item } = await cast();
    const hostile = '<script>alert("xss")</script>';

    await askAbout(item.id, hostile, { email: buyer.email });

    const message = await testDb.message.findFirstOrThrow();
    expect(message.body).toBe(hostile);
  });
});

describe("what the seller may see, MSG-2", () => {
  it("shows nothing at all until the admin relays", async () => {
    const { buyer, seller, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    const { status, body } = await readAs(thread.id, { email: seller.email });

    expect(status).toBe(200);
    expect(body.messages).toHaveLength(0);
  });

  it("shows the message once relayed, with no trace of who sent it", async () => {
    const { admin, buyer, seller, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const message = await testDb.message.findFirstOrThrow();

    await decide(message.id, "relay", { email: admin.email });
    const { body } = await readAs(message.threadId, { email: seller.email });

    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].body).toBe("Any scratches?");
    expect(body.messages[0].from).toBe("a buyer");

    // The whole response, not a chosen field: identity is dropped before it
    // leaves the server.
    const serialised = JSON.stringify(body);
    for (const leak of [buyer.id, buyer.email, buyer.firstName, buyer.phone]) {
      expect(serialised).not.toContain(leak);
    }
  });

  it("never reveals how many buyers are asking", async () => {
    const { admin, buyer, seller, item } = await cast();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });

    await askAbout(item.id, "From buyer one", { email: buyer.email });
    await askAbout(item.id, "From buyer two", { email: other.email });
    for (const message of await testDb.message.findMany()) {
      await decide(message.id, "relay", { email: admin.email });
    }

    const mine = await testDb.thread.findFirstOrThrow({ where: { buyerId: buyer.id } });
    const { body } = await readAs(mine.id, { email: seller.email });

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("From buyer two");
    expect(serialised).not.toContain(other.id);
  });

  it("refuses a seller reading a thread about another seller's item", async () => {
    const { buyer, item } = await cast();
    const otherSeller = await makeUser("seller", { email: "other.seller@test.local" });
    await askAbout(item.id, "Hello", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    const { status } = await readAs(thread.id, { email: otherSeller.email });

    expect(status).toBe(404);
  });

  it("refuses a buyer reading another buyer's thread", async () => {
    const { buyer, item } = await cast();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });
    await askAbout(item.id, "Mine", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    const { status } = await readAs(thread.id, { email: other.email });

    expect(status).toBe(404);
  });

  it("refuses a signed-out reader with 401", async () => {
    const { buyer, item } = await cast();
    await askAbout(item.id, "Mine", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    expect((await readAs(thread.id, null)).status).toBe(401);
  });
});

describe("the seller answering, SELL-3", () => {
  it("adds a reply the buyer sees once it is relayed", async () => {
    const { admin, buyer, seller, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    const { status } = await replyTo(thread.id, "None at all", { email: seller.email });
    expect(status).toBe(201);

    const reply = await testDb.message.findFirstOrThrow({ where: { senderId: seller.id } });
    expect(reply.visibleTo).toBe("seller_and_admin");

    // Before relaying, the buyer cannot see it.
    const before = await readAs(thread.id, { email: buyer.email });
    expect(JSON.stringify(before.body)).not.toContain("None at all");

    await decide(reply.id, "relay", { email: admin.email });
    const after = await readAs(thread.id, { email: buyer.email });
    expect(JSON.stringify(after.body)).toContain("None at all");
  });

  it("hides the seller's identity from the buyer as well", async () => {
    const { admin, buyer, seller, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    await replyTo(thread.id, "None at all", { email: seller.email });
    const reply = await testDb.message.findFirstOrThrow({ where: { senderId: seller.id } });
    await decide(reply.id, "relay", { email: admin.email });

    const { body } = await readAs(thread.id, { email: buyer.email });

    const serialised = JSON.stringify(body);
    for (const leak of [seller.id, seller.email, seller.firstName, seller.phone]) {
      expect(serialised).not.toContain(leak);
    }
  });

  it("refuses a reply from a seller who does not own the item", async () => {
    const { buyer, item } = await cast();
    const otherSeller = await makeUser("seller", { email: "other.seller@test.local" });
    await askAbout(item.id, "Hello", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    const { status } = await replyTo(thread.id, "Butting in", { email: otherSeller.email });

    expect(status).toBe(404);
    expect(await testDb.message.count()).toBe(1);
  });

  it("refuses a reply from a buyer who does not own the thread", async () => {
    const { buyer, item } = await cast();
    const other = await makeUser("buyer", { email: "other.buyer@test.local" });
    await askAbout(item.id, "Hello", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();

    const { status } = await replyTo(thread.id, "Butting in", { email: other.email });

    expect(status).toBe(404);
    expect(await testDb.message.count()).toBe(1);
  });
});

describe("the admin mediating, MSG-7", () => {
  it("sees both parties unmasked", async () => {
    const { admin, buyer, seller, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    await replyTo(thread.id, "None at all", { email: seller.email });

    const { status, body } = await readAs(thread.id, { email: admin.email });

    expect(status).toBe(200);
    expect(body.messages).toHaveLength(2);
    const names = body.messages.map((m: { from: string }) => m.from);
    expect(names).toContain(buyer.firstName);
    expect(names).toContain(seller.firstName);
  });

  it("relays a message to the counterparty", async () => {
    const { admin, buyer, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const message = await testDb.message.findFirstOrThrow();

    const { status } = await decide(message.id, "relay", { email: admin.email });

    expect(status).toBe(200);
    const after = await testDb.message.findUniqueOrThrow({ where: { id: message.id } });
    expect(after.visibleTo).toBe("both");
  });

  it("withholds a message, keeping it for the admin and its sender", async () => {
    const { admin, buyer, seller, item } = await cast();
    await askAbout(item.id, "Call me on 080...", { email: buyer.email });
    const message = await testDb.message.findFirstOrThrow();

    await decide(message.id, "withhold", { email: admin.email });

    const after = await testDb.message.findUniqueOrThrow({ where: { id: message.id } });
    expect(after.visibleTo).toBe("admin_only");

    // Still there for the admin and the sender, gone for the seller.
    const asAdmin = await readAs(message.threadId, { email: admin.email });
    expect(JSON.stringify(asAdmin.body)).toContain("Call me on 080");
    const asSender = await readAs(message.threadId, { email: buyer.email });
    expect(JSON.stringify(asSender.body)).toContain("Call me on 080");
    const asSeller = await readAs(message.threadId, { email: seller.email });
    expect(JSON.stringify(asSeller.body)).not.toContain("Call me on 080");
  });

  it("refuses moderation by anybody but the admin", async () => {
    const { buyer, seller, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const message = await testDb.message.findFirstOrThrow();

    expect((await decide(message.id, "relay", null)).status).toBe(401);
    expect((await decide(message.id, "relay", { email: seller.email })).status).toBe(403);
    expect((await decide(message.id, "relay", { email: buyer.email })).status).toBe(403);

    const after = await testDb.message.findUniqueOrThrow({ where: { id: message.id } });
    expect(after.visibleTo).toBe("buyer_and_admin");
  });

  it("refuses an unknown action", async () => {
    const { admin, buyer, item } = await cast();
    await askAbout(item.id, "Any scratches?", { email: buyer.email });
    const message = await testDb.message.findFirstOrThrow();

    const { status } = await postJson(
      (request: Request) => moderate(request, { params: Promise.resolve({ id: message.id }) }),
      `/api/admin/messages/${message.id}`,
      { action: "publish" },
      { as: { email: admin.email } },
    );

    expect(status).toBe(400);
  });
});

describe("polling, MSG-8", () => {
  it("returns only messages newer than the cursor", async () => {
    const { admin, buyer, seller, item } = await cast();
    await askAbout(item.id, "First", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    const first = await testDb.message.findFirstOrThrow();
    await decide(first.id, "relay", { email: admin.email });

    const initial = await readAs(thread.id, { email: seller.email });
    expect(initial.body.messages).toHaveLength(1);
    const cursor = initial.body.messages[0].id;

    // Nothing new yet.
    const quiet = await readAs(thread.id, { email: seller.email }, { after: cursor });
    expect(quiet.body.messages).toHaveLength(0);

    await replyTo(thread.id, "A reply", { email: seller.email });
    const reply = await testDb.message.findFirstOrThrow({ where: { senderId: seller.id } });
    await decide(reply.id, "relay", { email: admin.email });

    const polled = await readAs(thread.id, { email: seller.email }, { after: cursor });
    expect(polled.body.messages).toHaveLength(1);
    expect(polled.body.messages[0].body).toBe("A reply");
  });

  it("masks polled messages exactly as the first render does", async () => {
    const { admin, buyer, seller, item } = await cast();
    await askAbout(item.id, "First", { email: buyer.email });
    const thread = await testDb.thread.findFirstOrThrow();
    const message = await testDb.message.findFirstOrThrow();
    await decide(message.id, "relay", { email: admin.email });

    const { body } = await readAs(thread.id, { email: seller.email }, { after: "" });

    expect(JSON.stringify(body)).not.toContain(buyer.firstName);
    expect(body.messages[0].from).toBe("a buyer");
  });
});
