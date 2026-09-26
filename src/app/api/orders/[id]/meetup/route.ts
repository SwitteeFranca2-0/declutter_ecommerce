/**
 * POST /api/orders/[id]/meetup
 *
 * Propose a meetup point, or accept the one on the table. LOC-1, LOC-2.
 *
 * `{ action: "propose", lat, lng, label }` records a suggestion and writes it
 * into the direct thread. `{ action: "accept" }` turns the other party's
 * suggestion into an agreement.
 *
 * - 200 with the resulting meetup state
 * - 400 on coordinates that are not coordinates, a missing or over-long label,
 *   or an unknown action
 * - 401 signed out
 * - 403 for the admin, who reads everything and agrees nothing
 * - 404 for an order that is not the caller's
 * - 409 when there is nothing to accept, when the proposer tries to accept
 *   their own proposal, or when the order is no longer live
 */

import { NextResponse } from "next/server";

import { decideMeetup, meetupSchema } from "@/lib/meetup";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = meetupSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check the meetup point",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  const result = await decideMeetup(id, guard.user, parsed.data);

  if (!result.ok) {
    const status =
      result.reason === "not_found" ? 404 : result.reason === "forbidden" ? 403 : 409;

    return NextResponse.json(
      { error: result.message ?? "That order is not available." },
      { status, headers: NO_STORE },
    );
  }

  return NextResponse.json({ meetup: result.meetup }, { headers: NO_STORE });
}
