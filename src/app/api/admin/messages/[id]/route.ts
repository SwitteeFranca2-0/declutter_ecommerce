/**
 * POST /api/admin/messages/[id]
 *
 * Relay or withhold one message. MSG-7.
 *
 * This is what makes the admin a participant rather than a pipe. Relaying
 * moves a message to `both`; withholding moves it to `admin_only`, which keeps
 * it readable by the admin and by its sender and invisible to the
 * counterparty. Nothing is deleted, so mediation keeps its audit trail.
 *
 * - 200 with the resulting visibility
 * - 400 on an unknown action
 * - 401 signed out, 403 for anybody who is not the admin
 * - 404 for a message that does not exist
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { moderateMessage } from "@/lib/relay";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const actionSchema = z.object({ action: z.enum(["relay", "withhold"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireUser({ role: "admin" });
  if (!guard.ok) return guard.response;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose whether to relay or withhold this message." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const result = await moderateMessage(id, parsed.data.action);

  if (!result.ok) {
    return NextResponse.json({ error: "That message no longer exists." }, { status: 404 });
  }

  return NextResponse.json(
    { visibleTo: result.visibleTo },
    { headers: { "cache-control": "no-store" } },
  );
}
