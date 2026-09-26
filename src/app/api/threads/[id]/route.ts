/**
 * GET /api/threads/[id]
 *
 * Read one conversation, masked for whoever is asking.
 *
 * ── ASSESSED AJAX ─────────────────────────────────────────────────────────
 * This is the third assessed asynchronous interaction (MSG-8). The thread page
 * polls it with `fetch` on an interval, passing `?after=<id>` so a poll that
 * finds nothing new returns an empty list rather than the whole conversation.
 * New messages are appended to the DOM with no page reload.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Masking is applied here, server-side, before the response is serialised, so
 * a polled message carries exactly as little identity as the first render.
 */

import { NextResponse } from "next/server";

import { getThread } from "@/lib/relay";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const after = new URL(request.url).searchParams.get("after") ?? undefined;

  const result = await getThread(id, guard.user, after || undefined);

  if (!result.ok) {
    return NextResponse.json(
      { error: "That conversation is not available." },
      { status: 404 },
    );
  }

  return NextResponse.json(result.thread, {
    headers: { "cache-control": "no-store" },
  });
}
