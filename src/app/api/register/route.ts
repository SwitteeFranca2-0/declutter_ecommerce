/**
 * POST /api/register
 *
 * Creates a buyer or seller account. AUTH-1, AUTH-2, AUTH-5.
 *
 * - 201 with the new account, never including the password or its hash
 * - 400 on validation failure, including any attempt to register as admin
 * - 409 when the email is already registered, saying nothing about the
 *   existing account beyond the fact of the conflict
 */

import { NextResponse } from "next/server";

import { registerSchema, registerUser } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  // Validate at the boundary, before anything reaches a query. Unknown keys
  // are stripped, so an `idNumber` or a `role: "admin"` never gets further.
  const parsed = registerSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid registration",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = await registerUser(parsed.data);

  if (!result.ok) {
    return NextResponse.json(
      { error: "That email address is already registered. Sign in instead." },
      { status: 409 },
    );
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}
