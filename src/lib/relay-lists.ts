/**
 * Thread lists, one per role.
 *
 * Each list is scoped by the session user's id, never by anything in a URL,
 * the same rule the seller's submissions list and the confirmation page follow.
 *
 * The seller's list is the one to be careful with: it shows one row per
 * conversation about their own items and says nothing about how many other
 * conversations exist, because that count is the disclosure MSG-2 protects.
 */

import { prisma } from "@/lib/prisma";

export type ThreadSummary = {
  id: string;
  itemId: string;
  itemTitle: string;
  thumbnail: string | null;
  /** The most recent message this viewer may actually read. */
  lastMessage: string | null;
  lastAt: string | null;
  /** True when the other side spoke last and this viewer has not replied. */
  awaitingYou: boolean;
};

const LIST_INCLUDE = {
  item: {
    select: {
      id: true,
      title: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, senderId: true, visibleTo: true, createdAt: true },
  },
} as const;

type Visibility = "both" | "admin_only" | "buyer_and_admin" | "seller_and_admin";

function readableBy(
  visibility: Visibility,
  role: "buyer" | "seller",
  isSender: boolean,
): boolean {
  if (visibility === "both") return true;
  if (isSender) return true;
  return role === "buyer" ? visibility === "buyer_and_admin" : visibility === "seller_and_admin";
}

async function summarise(
  where: { buyerId?: string; item?: { sellerId: string } },
  viewerId: string,
  role: "buyer" | "seller",
): Promise<ThreadSummary[]> {
  const threads = await prisma.thread.findMany({
    where: { ...where, threadType: "relay" },
    orderBy: { createdAt: "desc" },
    include: LIST_INCLUDE,
  });

  return threads.map((thread) => {
    const visible = thread.messages.filter((message) =>
      readableBy(message.visibleTo as Visibility, role, message.senderId === viewerId),
    );
    const latest = visible[0] ?? null;

    return {
      id: thread.id,
      itemId: thread.item.id,
      itemTitle: thread.item.title,
      thumbnail: thread.item.images[0]?.url ?? null,
      lastMessage: latest?.body ?? null,
      lastAt: latest?.createdAt.toISOString() ?? null,
      // The other side spoke last, so this viewer owes a reply.
      awaitingYou: latest ? latest.senderId !== viewerId : false,
    };
  });
}

/** A buyer's own enquiries. */
export async function getBuyerThreads(buyerId: string): Promise<ThreadSummary[]> {
  return summarise({ buyerId }, buyerId, "buyer");
}

/** Enquiries about a seller's own items, with no hint of who is asking. */
export async function getSellerThreads(sellerId: string): Promise<ThreadSummary[]> {
  return summarise({ item: { sellerId } }, sellerId, "seller");
}

export type AdminThreadRow = {
  id: string;
  itemTitle: string;
  buyerName: string;
  sellerName: string;
  /** Messages waiting on a decision, oldest first, so nobody is left indefinitely. */
  waiting: number;
  oldestWaitingAt: string | null;
};

/**
 * The admin's queue.
 *
 * A message is waiting while it sits at its sender's initial visibility: it has
 * been neither relayed nor withheld. Threads with the longest wait come first.
 */
export async function getAdminQueue(): Promise<AdminThreadRow[]> {
  const threads = await prisma.thread.findMany({
    where: { threadType: "relay" },
    include: {
      item: { select: { title: true, seller: { select: { firstName: true } } } },
      buyer: { select: { firstName: true } },
      messages: {
        where: { visibleTo: { in: ["buyer_and_admin", "seller_and_admin"] } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      },
    },
  });

  return threads
    .map((thread) => ({
      id: thread.id,
      itemTitle: thread.item.title,
      // The admin sees both parties unmasked. MSG-7.
      buyerName: thread.buyer?.firstName ?? "A buyer",
      sellerName: thread.item.seller.firstName,
      waiting: thread.messages.length,
      oldestWaitingAt: thread.messages[0]?.createdAt.toISOString() ?? null,
    }))
    .sort((a, b) => {
      if (a.waiting !== b.waiting) return b.waiting - a.waiting;
      return (a.oldestWaitingAt ?? "").localeCompare(b.oldestWaitingAt ?? "");
    });
}
