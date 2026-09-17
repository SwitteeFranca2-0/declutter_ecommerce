/**
 * POST /api/verify-phone
 *
 * Simulated phone verification. AUTH-3.
 *
 * Any code is accepted, because an SMS provider is a credential the examiner
 * does not have (PRD §12.1). The interface says so plainly. What is real is
 * the guard: only a signed-in user can call this, and it only ever verifies
 * the caller, whatever identifiers the body carries.
 *
 * Sending `{ phone }` instead of `{ code }` corrects a mistyped number and
 * leaves it unverified.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { markPhoneVerified, registerSchema, updatePhone } from "@/lib/accounts";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The phone rule is reused from registration so the two cannot diverge. */
const bodySchema = z.union([
  z.object({ code: z.string().min(1).max(12) }),
  z.object({ phone: registerSchema.shape.phone }),
]);

export async function POST(request: Request) {
  // Guard first, before the body is even read.
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the code you were sent, or correct your phone number." },
      { status: 400 },
    );
  }

  // The caller's own id, never one from the request body.
  const user =
    "phone" in parsed.data
      ? await updatePhone(guard.user.id, parsed.data.phone)
      : await markPhoneVerified(guard.user.id);

  return NextResponse.json({ user }, { headers: { "cache-control": "no-store" } });
}
