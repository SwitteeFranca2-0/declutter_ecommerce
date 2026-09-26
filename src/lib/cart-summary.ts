/**
 * Resolving a cart against the database.
 *
 * The cart holds identifiers only, so everything a buyer sees about it is
 * computed here, on the server, from current rows:
 *
 * - the price, which may have changed since the item was added
 * - whether the item is still available, which is how BUY-6 works
 * - the deposit and balance totals, which are never sent up from the client
 *
 * An item that has been reserved, sold, withdrawn or deleted all resolve to
 * the same thing: unavailable. The buyer's options are identical in each case.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { releaseLapsedHolds } from "@/lib/items";
import { balanceFor, depositFor } from "@/lib/pricing";

/** Attacker-controlled: this arrives as a request body. */
export const cartRequestSchema = z.object({
  itemIds: z
    .array(z.string().min(1).max(64))
    // A cart larger than this is not a shopper, and the cap bounds the query.
    .max(50)
    .default([])
    // Deduplicated here as well as in `src/lib/cart.ts`, which already makes a
    // repeat add a no-op. A duplicate can therefore only arrive from a crafted
    // request, and it must not produce a second line: quantity is meaningless
    // when every listing is a unique single item, and two lines for one item
    // would double the deposit total. Order is preserved, because the cart
    // renders in the order the buyer added things.
    .transform((ids) => Array.from(new Set(ids))),
});

export type CartRequest = z.infer<typeof cartRequestSchema>;

export type CartLine = {
  id: string;
  title: string;
  category: string;
  condition: string;
  /** Null when the item is gone: there is no current price to show. */
  listedPrice: string | null;
  deposit: string | null;
  balance: string | null;
  thumbnail: string | null;
  available: boolean;
  /** Shown to the buyer. Null when the item is available. */
  unavailableReason: string | null;
};

export type CartSummary = {
  lines: CartLine[];
  availableCount: number;
  unavailableCount: number;
  /** Totals cover available items only. A buyer is never charged for a line they cannot receive. */
  priceTotal: string;
  depositTotal: string;
  balanceTotal: string;
};

const EMPTY: CartSummary = {
  lines: [],
  availableCount: 0,
  unavailableCount: 0,
  priceTotal: "0",
  depositTotal: "0",
  balanceTotal: "0",
};

/**
 * An item that vanished from the database entirely.
 *
 * Reachable in normal use: a buyer's localStorage outlives a `db:reset`, and
 * an admin may remove a listing. The cart must render, not crash.
 */
function missingLine(id: string): CartLine {
  return {
    id,
    title: "This item is no longer listed",
    category: "",
    condition: "",
    listedPrice: null,
    deposit: null,
    balance: null,
    thumbnail: null,
    available: false,
    unavailableReason: "No longer listed",
  };
}

/** Why an item cannot be bought, in the buyer's words. Shared with checkout. */
export function reasonFor(status: string): string {
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

/**
 * Resolve a list of item identifiers into a renderable cart.
 *
 * One query regardless of cart size: at ~130ms per round trip, a query per
 * line would make a five-item cart take most of a second.
 */
export async function getCartSummary(itemIds: readonly string[]): Promise<CartSummary> {
  if (itemIds.length === 0) return EMPTY;

  await releaseLapsedHolds();

  const rows = await prisma.item.findMany({
    where: { id: { in: [...itemIds] } },
    select: {
      id: true,
      title: true,
      category: true,
      condition: true,
      listedPrice: true,
      status: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));

  // Preserve the order the buyer added them in, rather than database order.
  const lines: CartLine[] = itemIds.map((id) => {
    const row = byId.get(id);
    if (!row) return missingLine(id);

    const available = row.status === "listed";
    const price = row.listedPrice.toString();

    return {
      id: row.id,
      title: row.title,
      category: row.category,
      condition: row.condition,
      // The current price, not whatever it was when the item was added.
      listedPrice: price,
      deposit: depositFor(price).toString(),
      balance: balanceFor(price).toString(),
      thumbnail: row.images[0]?.url ?? null,
      available,
      unavailableReason: available ? null : reasonFor(row.status),
    };
  });

  const availableLines = lines.filter((line) => line.available);

  const sum = (pick: (line: CartLine) => string | null) =>
    availableLines
      .reduce((total, line) => total.plus(pick(line) ?? "0"), depositFor("0"))
      .toString();

  return {
    lines,
    availableCount: availableLines.length,
    unavailableCount: lines.length - availableLines.length,
    priceTotal: sum((line) => line.listedPrice),
    depositTotal: sum((line) => line.deposit),
    balanceTotal: sum((line) => line.balance),
  };
}
