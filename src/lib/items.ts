/**
 * Reading items.
 *
 * Every read goes through here so that two rules hold everywhere: holds are
 * evaluated on read, and images come back in the same query as their item.
 *
 * The second rule is not a micro-optimisation. Against a pooled remote database
 * the round trip is ~130ms, so fetching each card's thumbnail separately turns
 * a catalogue page into several seconds. See `data-n-plus-one` in the
 * `postgres-practices` skill.
 */

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { balanceFor, depositFor } from "@/lib/pricing";

/**
 * Return items whose hold has lapsed to the marketplace.
 *
 * PRD §12.1: expiry is evaluated on read, with no cron and no background
 * worker, because a scheduler is a deployment dependency the examiner cannot
 * satisfy. Behaviour is indistinguishable from a scheduled job.
 *
 * Runs before any read that could surface a stale hold. Cheap: it touches
 * nothing when no hold has lapsed, which is the normal case.
 *
 * Wrapped in React's `cache` so it runs once per request rather than once per
 * read. Against a remote database each round trip is ~130ms, so a page that
 * reads items twice was paying for the scan twice.
 */
export const releaseLapsedHolds = cache(async (now: Date = new Date()): Promise<number> => {
  const lapsed = await prisma.order.findMany({
    where: { status: "deposit_paid", holdExpiresAt: { lte: now } },
    select: { id: true, itemId: true },
  });

  if (lapsed.length === 0) return 0;

  // One transaction: an item must never be listed while its order still looks
  // active, and an order must never be expired while its item stays on hold.
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { id: { in: lapsed.map((o) => o.id) } },
      data: { status: "expired" },
    }),
    prisma.item.updateMany({
      where: { id: { in: lapsed.map((o) => o.itemId) }, status: "on_hold" },
      data: { status: "listed" },
    }),
  ]);

  return lapsed.length;
});

/** What a card or a detail page needs, with prices already derived. */
export type ItemView = {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  listedPrice: string;
  deposit: string;
  balance: string;
  images: { url: string; sortOrder: number }[];
};

const ITEM_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  condition: true,
  listedPrice: true,
  images: {
    select: { url: true, sortOrder: true },
    // Lowest sortOrder leads: it is the card thumbnail and the opening image.
    orderBy: { sortOrder: "asc" },
  },
} as const;

type RawItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  listedPrice: { toString(): string };
  images: { url: string; sortOrder: number }[];
};

function toView(item: RawItem): ItemView {
  const price = item.listedPrice.toString();
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    condition: item.condition,
    listedPrice: price,
    // Server-side price authority: derived here, never accepted from a client.
    deposit: depositFor(price).toString(),
    balance: balanceFor(price).toString(),
    images: item.images,
  };
}

/**
 * One listed item with its images, or null.
 *
 * Returns null both for an item that does not exist and for one that is no
 * longer listed, because the buyer sees the same thing either way and the
 * difference would leak which items exist.
 */
export const getListedItem = cache(async (id: string): Promise<ItemView | null> => {
  await releaseLapsedHolds();

  const item = await prisma.item.findFirst({
    where: { id, status: "listed" },
    select: ITEM_SELECT,
  });

  return item ? toView(item as RawItem) : null;
});

/** Every listed item, newest first. Slice 03 adds filtering and sorting. */
export async function getListedItems(): Promise<ItemView[]> {
  await releaseLapsedHolds();

  const items = await prisma.item.findMany({
    where: { status: "listed" },
    select: ITEM_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => toView(item as RawItem));
}
