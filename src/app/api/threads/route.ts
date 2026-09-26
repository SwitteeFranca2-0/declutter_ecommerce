/**
 * POST /api/threads
 *
 * Send a message in the relay. BUY-4, SELL-3.
 *
 * `{ itemId, body }` opens or continues the buyer's conversation about that
 * item. `{ threadId, body }` posts to a conversation that already exists,
 * which is how a seller answers.
 *
 * - 201 with the thread as the sender may see it
 * - 400 on an empty, over-long or malformed body
 * - 401 signed out, 403 when the phone is unverified (AUTH-3)
 * - 404 for a thread that is not the caller's, or an item that is not listed
 *
 * A thread belonging to somebody else answers 404 rather than 403, so a thread
 * id in a URL cannot be used to discover which conversations exist.
 */

import { NextResponse } from "next/server";

import { messageSchema, postMessage } from "@/lib/relay";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function POST(request: Request) {
  // Guard first: the relay is not an open messaging service.
  const guard = await requireUser({ verifiedPhone: true });
  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check your message",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = await postMessage(guard.user, parsed.data);

  if (!result.ok) {
    if (result.reason === "conflict") {
      return NextResponse.json(
        { error: "That conversation was being opened already. Try again." },
        { status: 409, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      { error: "That conversation is not available." },
      { status: 404, headers: NO_STORE },
    );
  }

  return NextResponse.json({ thread: result.thread }, { status: 201, headers: NO_STORE });
}
