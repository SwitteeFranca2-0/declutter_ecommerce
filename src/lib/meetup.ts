/**
 * Agreeing where to meet. LOC-1, LOC-2, LOC-3.
 *
 * A proposal is not an agreement. One party drops a pin and proposes it; the
 * other accepts, and only then is the point agreed. A single stored point
 * cannot tell a suggestion from a decision, and that difference is the whole
 * meaning of "agree a meetup point" in PRD §14.7.
 *
 * **Where the state lives.** The point itself is on the order, which has
 * carried `meetupLat`, `meetupLng` and `meetupLabel` since the first
 * migration. Who proposed it, and whether anybody accepted, is derived from
 * the two server-written messages in the direct thread rather than from new
 * columns, so the schema Phase 1 assessed is unchanged. Those messages are
 * written only here and always with these exact prefixes, so they are a
 * reliable record rather than a guess about user text.
 *
 * The honest trade: two extra columns would be less indirect. This keeps the
 * ERD as submitted, and the thread has to carry the narrative anyway, so the
 * messages are not written solely to hold state.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hasHoldLapsed } from "@/lib/item-state";

/** Written only by this module, and matched only by this module. */
export const PROPOSED_PREFIX = "Proposed a meetup point: ";
export const AGREED_PREFIX = "Agreed the meetup point: ";

/** Attacker-controlled: this arrives as a request body. */
export const meetupSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("propose"),
    // Real coordinates, or nothing. A crafted request cannot store nonsense.
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z
      .string()
      .trim()
      .min(1, { error: "Name the place, for example 'main entrance'" })
      .max(120),
  }),
  z.object({ action: z.literal("accept") }),
]);

export type MeetupInput = z.infer<typeof meetupSchema>;

export type MeetupState = {
  lat: number;
  lng: number;
  label: string;
  agreed: boolean;
  /** Who suggested it. Null when nothing has been proposed. */
  proposedById: string | null;
};

export type MeetupResult =
  | { ok: true; meetup: MeetupState }
  | { ok: false; reason: "not_found" | "forbidden" | "conflict"; message?: string };

type Actor = { id: string; role: string };

const ORDER_INCLUDE = {
  item: { select: { sellerId: true, title: true } },
  threads: {
    where: { threadType: "direct" as const },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "asc" as const },
        select: { senderId: true, body: true },
      },
    },
    take: 1,
  },
} as const;

type LoadedOrder = {
  id: string;
  buyerId: string;
  status: string;
  holdExpiresAt: Date;
  meetupLat: number | null;
  meetupLng: number | null;
  meetupLabel: string | null;
  item: { sellerId: string; title: string };
  threads: { id: string; messages: { senderId: string; body: string }[] }[];
};

/**
 * Read the proposal state out of the thread.
 *
 * The last meetup message decides: an acceptance means agreed, a proposal
 * means waiting. The proposer is whoever sent the most recent proposal.
 */
export function readMeetupState(order: LoadedOrder): MeetupState | null {
  if (order.meetupLat === null || order.meetupLng === null || !order.meetupLabel) {
    return null;
  }

  const messages = order.threads[0]?.messages ?? [];

  let proposedById: string | null = null;
  let agreed = false;

  for (const message of messages) {
    if (message.body.startsWith(PROPOSED_PREFIX)) {
      proposedById = message.senderId;
      // A fresh proposal reopens the question.
      agreed = false;
    } else if (message.body.startsWith(AGREED_PREFIX)) {
      agreed = true;
    }
  }

  return {
    lat: order.meetupLat,
    lng: order.meetupLng,
    label: order.meetupLabel,
    agreed,
    proposedById,
  };
}

async function loadOrder(orderId: string): Promise<LoadedOrder | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerId: true,
      status: true,
      holdExpiresAt: true,
      meetupLat: true,
      meetupLng: true,
      meetupLabel: true,
      ...ORDER_INCLUDE,
    },
  });
}

/**
 * Propose a point, or accept the one on the table.
 *
 * Only the two parties to the order may do either: the admin reads everything
 * and agrees nothing, because an agreement between two people cannot be made
 * by a third.
 */
export async function decideMeetup(
  orderId: string,
  actor: Actor,
  input: MeetupInput,
): Promise<MeetupResult> {
  const order = await loadOrder(orderId);

  // A stranger gets the same answer as a missing order, so an order id in a
  // URL discovers nothing.
  if (!order) return { ok: false, reason: "not_found" };

  const isBuyer = order.buyerId === actor.id;
  const isSeller = order.item.sellerId === actor.id;

  if (!isBuyer && !isSeller) {
    // The admin is allowed to know the order exists, and is still refused.
    if (actor.role === "admin") {
      return {
        ok: false,
        reason: "forbidden",
        message: "A meetup is agreed between the buyer and the seller.",
      };
    }
    return { ok: false, reason: "not_found" };
  }

  if (hasHoldLapsed(order.holdExpiresAt) || order.status !== "deposit_paid") {
    return {
      ok: false,
      reason: "conflict",
      message: "This order is no longer live, so a meetup cannot be arranged.",
    };
  }

  const thread = order.threads[0];
  if (!thread) {
    return {
      ok: false,
      reason: "conflict",
      message: "This order has no conversation to record a meetup in.",
    };
  }

  const current = readMeetupState(order);

  if (input.action === "accept") {
    if (!current) {
      return {
        ok: false,
        reason: "conflict",
        message: "Nothing has been proposed yet.",
      };
    }

    if (current.agreed) {
      return { ok: true, meetup: current };
    }

    // Agreement means two people agreed, so the proposer cannot accept.
    if (current.proposedById === actor.id) {
      return {
        ok: false,
        reason: "conflict",
        message: "Wait for the other party to accept, or propose somewhere else.",
      };
    }

    await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: actor.id,
        body: `${AGREED_PREFIX}${current.label}`,
        visibleTo: "both",
      },
    });

    return { ok: true, meetup: { ...current, agreed: true } };
  }

  // A proposal replaces whatever was there and reopens the question.
  const [, ] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { meetupLat: input.lat, meetupLng: input.lng, meetupLabel: input.label },
    }),
    prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: actor.id,
        body: `${PROPOSED_PREFIX}${input.label}`,
        visibleTo: "both",
      },
    }),
  ]);

  return {
    ok: true,
    meetup: {
      lat: input.lat,
      lng: input.lng,
      label: input.label,
      agreed: false,
      proposedById: actor.id,
    },
  };
}
