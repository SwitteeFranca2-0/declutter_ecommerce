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
import type { CatalogueQuery } from "@/lib/item-query";

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
 * Null for an item that does not exist and for one that is not listed: this is
 * the buying path, and nothing that cannot be bought may come out of it.
 * `getItemForDisplay` is what renders an unavailable item.
 */
export const getListedItem = cache(async (id: string): Promise<ItemView | null> => {
  await releaseLapsedHolds();

  const item = await prisma.item.findFirst({
    where: { id, status: "listed" },
    select: ITEM_SELECT,
  });

  return item ? toView(item as RawItem) : null;
});

/** Why an item cannot be bought, in the buyer's words. */
function unavailableReason(status: string): string {
  switch (status) {
    case "on_hold":
      return "Reserved by another buyer";
    case "sold":
    case "completed":
      return "Sold";
    default:
      // pending_review, rejected: never publicly visible in the first place.
      return "No longer listed";
  }
}

export type ItemDisplay = {
  item: ItemView;
  available: boolean;
  /** Null when the item can be bought. */
  reason: string | null;
};

/**
 * One item as a page may show it, available or not.
 *
 * A buyer who followed a link from their cart, or from a page open since
 * yesterday, should see **which** item went and why, rather than a generic
 * refusal that leaves them guessing. So a real id returns the item with a
 * reason, and an id that was never issued still returns null.
 *
 * This reverses the earlier rule that the two cases were indistinguishable.
 * The trade is deliberate: ids are cuids, so anybody holding one has already
 * seen the item, and the cost of the old rule fell entirely on honest buyers.
 * Nothing about the seller is included, and the buying path is untouched.
 */
export const getItemForDisplay = cache(async (id: string): Promise<ItemDisplay | null> => {
  await releaseLapsedHolds();

  const item = await prisma.item.findUnique({
    where: { id },
    select: { ...ITEM_SELECT, status: true },
  });

  if (!item) return null;

  const available = item.status === "listed";

  return {
    item: toView(item as RawItem),
    available,
    reason: available ? null : unavailableReason(item.status),
  };
});

const ORDER_BY = {
  newest: { createdAt: "desc" },
  price_asc: { listedPrice: "asc" },
  price_desc: { listedPrice: "desc" },
} as const;

/**
 * The catalogue.
 *
 * `status: "listed"` is applied unconditionally and is not derived from any
 * input, so no query string can widen the result beyond what is publicly
 * visible. The category, already validated against the enum, only ever narrows
 * it further.
 */
export const getListedItems = cache(
  async (query: CatalogueQuery = { sort: "newest" }): Promise<ItemView[]> => {
    await releaseLapsedHolds();

    const items = await prisma.item.findMany({
      where: {
        status: "listed",
        ...(query.category ? { category: query.category } : {}),
      },
      select: ITEM_SELECT,
      orderBy: ORDER_BY[query.sort],
    });

    return items.map((item) => toView(item as RawItem));
  },
);
