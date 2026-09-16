/**
 * POST /api/cart
 *
 * Resolves a list of item identifiers into a renderable cart: current prices,
 * availability and totals.
 *
 * This is the second assessed asynchronous interaction. The header badge and
 * the cart page both call it with `fetch` and update in place, with no reload.
 *
 * POST rather than GET because the payload is a list of identifiers that would
 * make an unwieldy query string, and because the response must never be cached:
 * availability changes the moment another buyer deposits.
 */

import { NextResponse } from "next/server";

import { cartRequestSchema, getCartSummary } from "@/lib/cart-summary";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  // Validate at the boundary, before anything reaches a query.
  const parsed = cartRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid cart",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const summary = await getCartSummary(parsed.data.itemIds);

  return NextResponse.json(summary, {
    headers: { "cache-control": "no-store" },
  });
}
