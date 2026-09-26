/**
 * Thread lists, at the database seam.
 *
 * Each list is scoped to the viewer. The seller's list is the one that matters:
 * it must carry no hint of who is asking, and no hint of how many people are.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeItem, makeUser, resetDb, testDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { getAdminQueue, getBuyerThreads, getSellerThreads } = await import("@/lib/relay-lists");

async function thread(itemId: string, buyerId: string) {
  return testDb.thread.create({
    data: { itemId, buyerId, threadType: "relay", status: "open" },
  });
}

async function message(
  threadId: string,
  senderId: string,
  body: string,
  visibleTo: "both" | "admin_only" | "buyer_and_admin" | "seller_and_admin",
) {
  return testDb.message.create({ data: { threadId, senderId, body, visibleTo } });
}

describe("a buyer's own enquiries", () => {
  it("lists their threads and not anybody else's", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer", { firstName: "Chidi" });
    const other = await makeUser("buyer");
    const item = await makeItem(seller.id, { title: "Guitar" });

    const mine = await thread(item.id, buyer.id);
    await message(mine.id, buyer.id, "Mine", "buyer_and_admin");
    const theirs = await thread(item.id, other.id);
    await message(theirs.id, other.id, "Theirs", "buyer_and_admin");

    const rows = await getBuyerThreads(buyer.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(mine.id);
    expect(rows[0].itemTitle).toBe("Guitar");
    expect(rows[0].lastMessage).toBe("Mine");
  });

  it("does not show a withheld message from the other side", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    const t = await thread(item.id, buyer.id);
    await message(t.id, buyer.id, "My question", "both");
    await message(t.id, seller.id, "Withheld reply", "admin_only");

    const [row] = await getBuyerThreads(buyer.id);

    expect(row.lastMessage).toBe("My question");
  });
});

describe("a seller's enquiries", () => {
  it("shows threads about their own items only", async () => {
    const seller = await makeUser("seller");
    const otherSeller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const mine = await makeItem(seller.id, { title: "Mine" });
    const theirs = await makeItem(otherSeller.id, { title: "Theirs" });

    const a = await thread(mine.id, buyer.id);
    await message(a.id, buyer.id, "About yours", "both");
    const b = await thread(theirs.id, buyer.id);
    await message(b.id, buyer.id, "About theirs", "both");

    const rows = await getSellerThreads(seller.id);

    expect(rows.map((row) => row.itemTitle)).toEqual(["Mine"]);
  });

  it("carries no buyer identity anywhere in the row", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer", { firstName: "Chidi", email: "chidi@test.local" });
    const item = await makeItem(seller.id);
    const t = await thread(item.id, buyer.id);
    await message(t.id, buyer.id, "Any scratches?", "both");

    const rows = await getSellerThreads(seller.id);

    const serialised = JSON.stringify(rows);
    for (const leak of [buyer.id, buyer.email, buyer.firstName, buyer.phone]) {
      expect(serialised).not.toContain(leak);
    }
  });

  it("hides a message the admin has not relayed", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    const t = await thread(item.id, buyer.id);
    await message(t.id, buyer.id, "Not relayed yet", "buyer_and_admin");

    const [row] = await getSellerThreads(seller.id);

    expect(row.lastMessage).toBeNull();
    expect(row.awaitingYou).toBe(false);
  });

  it("marks a relayed question as awaiting the seller", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    const t = await thread(item.id, buyer.id);
    await message(t.id, buyer.id, "Relayed question", "both");

    const [row] = await getSellerThreads(seller.id);

    expect(row.awaitingYou).toBe(true);
  });
});

describe("the admin queue", () => {
  it("counts messages waiting on a decision and names both parties", async () => {
    const seller = await makeUser("seller", { firstName: "Sade" });
    const buyer = await makeUser("buyer", { firstName: "Chidi" });
    const item = await makeItem(seller.id, { title: "Guitar" });
    const t = await thread(item.id, buyer.id);
    await message(t.id, buyer.id, "Waiting one", "buyer_and_admin");
    await message(t.id, buyer.id, "Waiting two", "buyer_and_admin");
    await message(t.id, buyer.id, "Already relayed", "both");

    const [row] = await getAdminQueue();

    expect(row.waiting).toBe(2);
    expect(row.buyerName).toBe("Chidi");
    expect(row.sellerName).toBe("Sade");
    expect(row.itemTitle).toBe("Guitar");
  });

  it("puts the threads with most waiting first, then the longest wait", async () => {
    const seller = await makeUser("seller");
    const buyerA = await makeUser("buyer");
    const buyerB = await makeUser("buyer");
    const item = await makeItem(seller.id);

    const quiet = await thread(item.id, buyerA.id);
    await message(quiet.id, buyerA.id, "One waiting", "buyer_and_admin");
    const busy = await thread(item.id, buyerB.id);
    await message(busy.id, buyerB.id, "First", "buyer_and_admin");
    await message(busy.id, buyerB.id, "Second", "buyer_and_admin");

    const rows = await getAdminQueue();

    expect(rows.map((row) => row.id)).toEqual([busy.id, quiet.id]);
  });

  it("shows a thread with nothing waiting as zero rather than omitting it", async () => {
    const seller = await makeUser("seller");
    const buyer = await makeUser("buyer");
    const item = await makeItem(seller.id);
    const t = await thread(item.id, buyer.id);
    await message(t.id, buyer.id, "Handled", "both");

    const [row] = await getAdminQueue();

    expect(row.waiting).toBe(0);
    expect(row.oldestWaitingAt).toBeNull();
  });
});
