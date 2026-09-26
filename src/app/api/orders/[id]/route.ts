/**
 * GET /api/orders/[id]
 *
 * One order, with whatever contact details the viewer has earned. BUY-8.
 *
 * - 200 with the order: the buyer sees the seller's name and phone, the seller
 *   sees the buyer's first name, the admin sees both
 * - 401 signed out
 * - 404 for an order that is not the caller's, which is the same answer as one
 *   that does not exist
 */

import { NextResponse } from "next/server";

import { getOrderFor } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const order = await getOrderFor(id, guard.user);

  if (!order) {
    return NextResponse.json({ error: "That order is not available." }, { status: 404 });
  }

  return NextResponse.json(order, { headers: { "cache-control": "no-store" } });
}
