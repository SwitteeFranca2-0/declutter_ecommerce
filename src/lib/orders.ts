/**
 * Reading a buyer's orders.
 *
 * Checkout writes a durable record and the confirmation page shows it once,
 * but that page is reachable only from the checkout that produced it. These
 * reads are the way back: a list of the buyer's orders, and a page per order.
 *
 * Every read is scoped to the buyer, never to an id from a URL, so an order id
 * someone guesses or shares is not a way into another person's purchase. A
 * missing order and somebody else's order return the same thing, which is what
 * lets the page answer 404 to both.
 *
 * What is deliberately absent: the seller's name and phone number. A deposit
 * unlocks those under BUY-8, which arrives with the direct thread in Stage C.
 * Nothing here leaks them early.
 */

import { prisma } from "@/lib/prisma";
import { orderReference } from "@/lib/checkout";
import { releaseLapsedHolds } from "@/lib/items";

export type BuyerOrder = {
  id: string;
  reference: string;
  itemId: string;
  itemTitle: string;
  thumbnail: string | null;
  status: string;
  listedPrice: string;
  depositAmount: string;
  balanceAmount: string;
  holdExpiresAt: string;
  createdAt: string;
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
  item: {
    select: {
      title: true,
      listedPrice: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
    },
  },
} as const;

type Row = {
  id: string;
  itemId: string;
  buyerId: string;
  status: string;
  depositAmount: { toString(): string };
  balanceAmount: { toString(): string };
  holdExpiresAt: Date;
  createdAt: Date;
  item: {
    title: string;
    listedPrice: { toString(): string };
    images: { url: string }[];
  };
};

function toView(order: Row): BuyerOrder {
  return {
    id: order.id,
    reference: orderReference(order.id),
    itemId: order.itemId,
    itemTitle: order.item.title,
    thumbnail: order.item.images[0]?.url ?? null,
    status: order.status,
    listedPrice: order.item.listedPrice.toString(),
    depositAmount: order.depositAmount.toString(),
    balanceAmount: order.balanceAmount.toString(),
    holdExpiresAt: order.holdExpiresAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
  };
}

/**
 * Every order this buyer has placed, newest first.
 *
 * Lapsed holds are released before the read, so a buyer is shown what actually
 * happened rather than a reservation that expired hours ago. An expired order
 * stays in the list: it is part of their history.
 */
export async function getBuyerOrderList(buyerId: string): Promise<BuyerOrder[]> {
  await releaseLapsedHolds();

  const orders = await prisma.order.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    select: ORDER_SELECT,
  });

  return orders.map((order) => toView(order as Row));
}

/** One order, or null when it is not this buyer's. */
export async function getOrderForBuyer(
  orderId: string,
  buyerId: string,
): Promise<BuyerOrder | null> {
  await releaseLapsedHolds();

  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerId },
    select: ORDER_SELECT,
  });

  return order ? toView(order as Row) : null;
}
