/**
 * Checkout: paying the deposit.
 *
 * This is the deposit step of the real escrow flow, not a placeholder for it
 * (BUY-7, ADR-0001). Each item in the cart becomes its own order, moves
 * `listed` to `on_hold`, and is held for 72 hours. Payment itself is simulated
 * (PRD §12.1): recording the deposit is the same state change a gateway
 * webhook would drive.
 *
 * Three rules this module exists to keep:
 *
 * 1. **The server sets every amount.** The request carries item identifiers
 *    and an acceptance of the refund terms, nothing else. Deposit and balance
 *    are derived from the stored price inside the transaction. PRD §10.4.
 * 2. **All or nothing.** If any item is unavailable, no order is created and
 *    no item changes status. The buyer is told which items to remove.
 * 3. **One active order per item.** A conditional update claims each item,
 *    and the partial unique index on `orders(itemId)` backs it up. The losing
 *    side of a race gets a conflict, never a second order and never a 500.
 *
 * The deposit is also the moment the two parties stop being strangers. Each
 * order opens a direct thread in this same transaction (MSG-3), and the
 * buyer's earlier relay thread about that item is closed, because there should
 * be one place to write. If a thread cannot be opened the order is not written
 * either: a buyer charged for an item with no way to arrange collection is
 * worse than a failed checkout.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { reasonFor } from "@/lib/cart-summary";
import { applyTrigger, holdExpiryFrom } from "@/lib/item-state";
import { releaseLapsedHolds } from "@/lib/items";
import { balanceFor, depositFor } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

/**
 * Attacker-controlled: this arrives as a request body.
 *
 * Unknown keys are stripped, so a tampered `depositAmount` or `total` never
 * reaches anything below this line.
 */
export const checkoutRequestSchema = z.object({
  itemIds: z.array(z.string().min(1).max(64)).max(50),
  // BUY-7: refund terms are shown before payment and must be accepted.
  acceptedTerms: z.literal(true, { error: "The refund terms must be accepted" }),
});

export type PlacedOrder = {
  id: string;
  reference: string;
  itemId: string;
  title: string;
  listedPrice: string;
  depositAmount: string;
  balanceAmount: string;
  holdExpiresAt: string;
};

export type UnavailableItem = { id: string; reason: string };

export type CheckoutResult =
  | { ok: true; orders: PlacedOrder[] }
  | { ok: false; unavailable: UnavailableItem[] };

/**
 * A short reference a buyer can read out, derived from the order id.
 *
 * The tail of a cuid is its random part, so eight characters of it are
 * distinct in practice at this scale. The id remains the real key.
 */
export function orderReference(orderId: string): string {
  return `DCL-${orderId.slice(-8).toUpperCase()}`;
}

/** Order statuses covered by the partial unique index. */
const ACTIVE_ORDER_STATUSES = ["deposit_paid", "balance_paid"] as const;

/** Raised inside the transaction to roll it back. Never escapes this module. */
class ItemsUnavailable extends Error {
  constructor(readonly unavailable: UnavailableItem[]) {
    super("Items unavailable");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** The deposit transition, read from the state machine rather than restated here. */
const ON_HOLD = (() => {
  const result = applyTrigger("listed", "deposit_recorded");
  if (!result.ok) throw new Error(result.reason);
  return result.to;
})();

/**
 * Place one order per item for this buyer.
 *
 * Returns the orders, or every unavailable item so the buyer can fix the cart
 * in one pass. An empty list is a validation failure for the route to refuse
 * before calling this.
 */
export async function placeOrders(
  buyerId: string,
  requestedIds: readonly string[],
  now: Date = new Date(),
): Promise<CheckoutResult> {
  // Sorted so concurrent checkouts sharing items always lock rows in the same
  // order and cannot deadlock. Deduplicated because every item is unique.
  const itemIds = Array.from(new Set(requestedIds)).sort();

  // A lapsed hold must be released first, or its item would read as reserved.
  await releaseLapsedHolds(now);

  try {
    const orders = await prisma.$transaction(
      async (tx) => {
        const unavailable: string[] = [];

        // Claim each item. The status condition makes this a compare-and-set:
        // a concurrent checkout blocks on the row lock, then re-reads the row,
        // finds it no longer 'listed', and updates nothing.
        for (const id of itemIds) {
          const claimed = await tx.item.updateMany({
            where: { id, status: "listed" },
            data: { status: ON_HOLD },
          });
          if (claimed.count === 0) unavailable.push(id);
        }

        if (unavailable.length > 0) {
          const rows = await tx.item.findMany({
            where: { id: { in: unavailable } },
            select: { id: true, status: true },
          });
          const statusById = new Map(rows.map((row) => [row.id, row.status]));

          throw new ItemsUnavailable(
            unavailable.map((id) => {
              const status = statusById.get(id);
              return { id, reason: status ? reasonFor(status) : "No longer listed" };
            }),
          );
        }

        // The prices charged are the ones stored now, read under the row locks
        // just taken, so no re-price can slip in between claim and charge.
        const items = await tx.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, title: true, listedPrice: true },
          orderBy: { id: "asc" },
        });

        const holdExpiresAt = holdExpiryFrom(now);

        const created = await tx.order.createManyAndReturn({
          data: items.map((item) => ({
            itemId: item.id,
            buyerId,
            depositAmount: depositFor(item.listedPrice),
            balanceAmount: balanceFor(item.listedPrice),
            holdExpiresAt,
          })),
        });

        // MSG-3: one direct conversation per order, opened automatically.
        await tx.thread.createMany({
          data: created.map((order) => ({
            itemId: order.itemId,
            orderId: order.id,
            // Copied from the order per ADR-0002, so "threads this person can
            // see" stays one predicate.
            buyerId,
            threadType: "direct" as const,
            status: "open" as const,
          })),
        });

        // The relay about this item, for this buyer only, has been superseded.
        // Locked rather than deleted: the history stays readable and the thread
        // page already refuses new messages on a locked thread.
        await tx.thread.updateMany({
          where: {
            buyerId,
            itemId: { in: itemIds },
            threadType: "relay",
            status: "open",
          },
          data: {
            status: "locked",
            lockedReason: "Continued in your direct conversation with the seller",
            lockedAt: now,
          },
        });

        const byItem = new Map(items.map((item) => [item.id, item]));

        return created.map((order): PlacedOrder => {
          const item = byItem.get(order.itemId);
          return {
            id: order.id,
            reference: orderReference(order.id),
            itemId: order.itemId,
            title: item?.title ?? "",
            listedPrice: item?.listedPrice.toString() ?? "",
            depositAmount: order.depositAmount.toString(),
            balanceAmount: order.balanceAmount.toString(),
            holdExpiresAt: order.holdExpiresAt.toISOString(),
          };
        });
      },
      // Generous limits: against a pooled remote database each statement is a
      // ~130ms round trip, and the default 5s would fail a large cart.
      { maxWait: 10_000, timeout: 20_000 },
    );

    return { ok: true, orders };
  } catch (error) {
    if (error instanceof ItemsUnavailable) {
      return { ok: false, unavailable: error.unavailable };
    }

    // The partial unique index refused a second active order. The transaction
    // has rolled back; report which items already carry one.
    if (isUniqueViolation(error)) {
      const active = await prisma.order.findMany({
        where: { itemId: { in: itemIds }, status: { in: [...ACTIVE_ORDER_STATUSES] } },
        select: { itemId: true },
      });
      const reserved = new Set(active.map((order) => order.itemId));

      return {
        ok: false,
        unavailable: itemIds
          .filter((id) => reserved.has(id))
          .map((id) => ({ id, reason: reasonFor("on_hold") })),
      };
    }

    throw error;
  }
}

/** A placed order as the confirmation page shows it. */
export type ConfirmedOrder = PlacedOrder & { thumbnail: string | null };

/**
 * The buyer's own orders, by id, for the confirmation page.
 *
 * Scoped to the buyer, so an order id belonging to someone else resolves to
 * nothing rather than exposing their purchase.
 */
export async function getBuyerOrders(
  buyerId: string,
  orderIds: readonly string[],
): Promise<ConfirmedOrder[]> {
  if (orderIds.length === 0) return [];

  const orders = await prisma.order.findMany({
    where: { id: { in: [...orderIds] }, buyerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      itemId: true,
      depositAmount: true,
      balanceAmount: true,
      holdExpiresAt: true,
      item: {
        select: {
          title: true,
          listedPrice: true,
          images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    reference: orderReference(order.id),
    itemId: order.itemId,
    title: order.item.title,
    listedPrice: order.item.listedPrice.toString(),
    depositAmount: order.depositAmount.toString(),
    balanceAmount: order.balanceAmount.toString(),
    holdExpiresAt: order.holdExpiresAt.toISOString(),
    thumbnail: order.item.images[0]?.url ?? null,
  }));
}
