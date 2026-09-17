/**
 * POST /api/checkout
 *
 * Pays the (simulated) deposit on every item in the cart. BUY-7.
 *
 * The body is `{ itemIds, acceptedTerms: true }` and nothing else is read from
 * it. Every amount is derived on the server from stored prices; see
 * `src/lib/checkout.ts`.
 *
 * - 201 with the placed orders
 * - 401 when nobody is signed in: an order must have an owner
 * - 403 when the buyer's phone is unverified (AUTH-3), naming the page to fix it
 * - 400 for an empty cart, unaccepted terms or a malformed body
 * - 409 with the unavailable items when any item can no longer be bought, in
 *   which case no order at all was created
 *
 * Called with `fetch` from the checkout page, which then clears the ordered
 * items from the cart and moves to the confirmation page.
 */

import { NextResponse } from "next/server";

import { checkoutRequestSchema, placeOrders } from "@/lib/checkout";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request) {
  // Guard first: session, then AUTH-3's verified-phone requirement, before the
  // body is read and before anything reaches the database.
  const guard = await requireUser({ verifiedPhone: true });
  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  // Validate at the boundary, before anything reaches a query.
  const parsed = checkoutRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid checkout",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  if (parsed.data.itemIds.length === 0) {
    return NextResponse.json(
      { error: "Your cart is empty. Add an item before paying a deposit." },
      { status: 400 },
    );
  }

  const result = await placeOrders(guard.user.id, parsed.data.itemIds);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: "Some items in your cart can no longer be reserved. Nothing was charged.",
        unavailable: result.unavailable,
      },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json({ orders: result.orders }, { status: 201, headers: NO_STORE });
}
