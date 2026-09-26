/**
 * Reading an order. BUY-8.
 *
 * This module owns one rule: **a deposit is what releases the seller's contact
 * details**. Before an order exists, a buyer sees a listing and no person
 * behind it. After one exists, the buyer sees the seller's name and phone
 * number, because they have money at risk and are about to travel to meet a
 * stranger.
 *
 * The asymmetry is deliberate. The seller receives the buyer's first name and
 * no contact details: the platform holds the money, the item has not moved,
 * and the seller is not the one travelling. Whether sellers should eventually
 * receive them is PRD §15 open question 3, which is open and is not answered
 * here.
 *
 * Keeping the rule in one function means no page has to remember it.
 */

import { prisma } from "@/lib/prisma";
import { releaseLapsedHolds } from "@/lib/items";
import { orderReference } from "@/lib/checkout";
import { readMeetupState, type MeetupState } from "@/lib/meetup";

export type OrderView = {
  id: string;
  reference: string;
  itemId: string;
  itemTitle: string;
  thumbnail: string | null;
  status: string;
  depositAmount: string;
  balanceAmount: string;
  listedPrice: string;
  holdExpiresAt: string;
  createdAt: string;
  /** The direct conversation opened when the deposit was recorded. */
  threadId: string | null;
  /** Released by the deposit, and only to the buyer. */
  seller: { firstName: string; phone: string } | null;
  /** The seller sees who they are dealing with by first name, nothing more. */
  buyer: { firstName: string } | null;
  /** Where the handover happens, once somebody has proposed one. LOC-2. */
  meetup: MeetupState | null;
};

const ORDER_SELECT = {
  id: true,
  itemId: true,
  buyerId: true,
  status: true,
  depositAmount: true,
  balanceAmount: true,
  holdExpiresAt: true,
  createdAt: true,
  buyer: { select: { firstName: true } },
  item: {
    select: {
      title: true,
      listedPrice: true,
      sellerId: true,
      seller: { select: { firstName: true, phone: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  },
  meetupLat: true,
  meetupLng: true,
  meetupLabel: true,
  threads: {
    where: { threadType: "direct" as const },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "asc" as const },
        select: { senderId: true, body: true },
      },
    },
    take: 1,
  },
} as const;

type Viewer = { id: string; role: string };

/**
 * One order, as this viewer may see it.
 *
 * A buyer sees their own; a seller sees orders on their items; the admin sees
 * everything. Anybody else gets null, which callers turn into a 404 rather
 * than a 403, so an order id in a URL discovers nothing.
 */
export async function getOrderFor(
  orderId: string,
  viewer: Viewer,
): Promise<OrderView | null> {
  // A lapsed hold must be released before an order is read, or a buyer would
  // be shown a reservation that no longer exists.
  await releaseLapsedHolds();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: ORDER_SELECT,
  });

  if (!order) return null;

  const isBuyer = order.buyerId === viewer.id;
  const isSeller = order.item.sellerId === viewer.id;
  const isAdmin = viewer.role === "admin";

  if (!isBuyer && !isSeller && !isAdmin) return null;

  return {
    id: order.id,
    reference: orderReference(order.id),
    itemId: order.itemId,
    itemTitle: order.item.title,
    thumbnail: order.item.images[0]?.url ?? null,
    status: order.status,
    depositAmount: order.depositAmount.toString(),
    balanceAmount: order.balanceAmount.toString(),
    listedPrice: order.item.listedPrice.toString(),
    holdExpiresAt: order.holdExpiresAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    threadId: order.threads[0]?.id ?? null,
    // BUY-8: the deposit is what unlocks this, and only for the buyer who paid.
    // The admin sees it too, because mediation needs the full picture.
    seller: isBuyer || isAdmin ? order.item.seller : null,
    // A first name and nothing else. Never a phone number, never an email.
    buyer: isSeller || isAdmin ? { firstName: order.buyer.firstName } : null,
    // Both parties and the admin see the meetup: it is the fact the order
    // carries, and a dispute has to be reconstructable (MSG-7).
    meetup: readMeetupState(order),
  };
}

/** A buyer's own orders, newest first. */
export async function getBuyerOrderList(buyerId: string): Promise<OrderView[]> {
  await releaseLapsedHolds();

  const orders = await prisma.order.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const views = await Promise.all(
    orders.map((order) => getOrderFor(order.id, { id: buyerId, role: "buyer" })),
  );

  return views.filter((view): view is OrderView => view !== null);
}

/** Orders on a seller's own items, newest first. */
export async function getSellerOrderList(sellerId: string): Promise<OrderView[]> {
  await releaseLapsedHolds();

  const orders = await prisma.order.findMany({
    where: { item: { sellerId } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const views = await Promise.all(
    orders.map((order) => getOrderFor(order.id, { id: sellerId, role: "seller" })),
  );

  return views.filter((view): view is OrderView => view !== null);
}
