/**
 * POST /api/admin/items/[id]/review
 *
 * The admin approves and prices a submission, or rejects it with a reason.
 * ADMIN-2, ADMIN-3, ADMIN-4.
 *
 * - 200 with the decided item
 * - 400 on validation, including a price at or below the seller's payout
 * - 401 signed out, 403 for anyone who is not the admin (AUTH-6)
 * - 404 for an item that does not exist
 * - 409 for a submission already decided, including by a concurrent request
 */

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/session";
import { reviewSchema, reviewSubmission } from "@/lib/review";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Guard before the body is read: nothing about the submission is touched by
  // a request that was never allowed to make one.
  const guard = await requireUser({ role: "admin" });
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check the decision before submitting it",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "decision",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const outcome = await reviewSubmission(guard.user.id, id, parsed.data);

  if (!outcome.ok) {
    return NextResponse.json(
      {
        error: outcome.reason,
        details: outcome.field
          ? [{ field: outcome.field, message: outcome.reason }]
          : undefined,
      },
      { status: outcome.status },
    );
  }

  return NextResponse.json({ item: outcome.item });
}
