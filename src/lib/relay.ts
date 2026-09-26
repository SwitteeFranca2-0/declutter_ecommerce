/**
 * The information request relay. BUY-4, SELL-3, MSG-1, MSG-2, MSG-7.
 *
 * A buyer asks about an item before any deposit exists. The admin reads both
 * sides unmasked and decides what is relayed. The seller answers without ever
 * learning who asked.
 *
 * Two rules carry the whole design:
 *
 * 1. **`visibleTo` is addressed by the server.** A buyer's message is stored
 *    `buyer_and_admin` and a seller's `seller_and_admin`, so neither reaches
 *    the counterparty until the admin moves it to `both`. Withholding moves it
 *    to `admin_only`, which keeps it readable by the admin and its sender and
 *    invisible to the other side. The value is never read from a request.
 * 2. **Masking happens at serialisation, not at render.** A thread serialised
 *    for the seller contains no buyer id, name, email or phone at all, so a
 *    curious seller reading the network tab finds nothing. Identity is dropped
 *    here, before the response leaves.
 *
 * One relay thread per buyer per item is enforced by a partial unique index
 * (ADR-0002), not by application code.
 */

import { Prisma, type MessageVisibility, type User } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

/** Attacker-controlled: message bodies arrive as request bodies. */
const body = z
  .string()
  .trim()
  .min(1, { error: "Write a message first" })
  .max(2000, { error: "Keep a message under 2000 characters" });

/**
 * Starting a conversation and continuing one are the same request.
 *
 * `itemId` opens or continues the caller's thread about that item; `threadId`
 * posts to a thread that already exists, which is how a seller replies.
 * `visibleTo` is absent by design: Zod drops unknown keys, so a request
 * carrying it changes nothing.
 */
export const messageSchema = z.union([
  z.object({ itemId: z.string().min(1).max(64), body }),
  z.object({ threadId: z.string().min(1).max(64), body }),
]);

export type MessageInput = z.infer<typeof messageSchema>;

/** How a message is stored, by who sent it. */
const INITIAL_VISIBILITY: Record<"buyer" | "seller", MessageVisibility> = {
  buyer: "buyer_and_admin",
  seller: "seller_and_admin",
};

/** What the admin's decision does to it. */
export const MODERATION: Record<"relay" | "withhold", MessageVisibility> = {
  relay: "both",
  withhold: "admin_only",
};

export type RelayMessage = {
  id: string;
  body: string;
  /** A name for the admin, a role for everybody else. Never an identifier. */
  from: string;
  mine: boolean;
  /** Only ever sent to the admin: the two parties do not see moderation state. */
  visibleTo?: MessageVisibility;
  createdAt: string;
};

export type RelayThread = {
  id: string;
  itemId: string;
  itemTitle: string;
  status: string;
  messages: RelayMessage[];
};

export type ThreadResult =
  | { ok: true; thread: RelayThread }
  | { ok: false; reason: "not_found" | "conflict" | "item_unavailable" | "locked" };

type Viewer = Pick<User, "id" | "role">;

const THREAD_INCLUDE = {
  item: { select: { id: true, title: true, sellerId: true } },
  messages: {
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, role: true, firstName: true } } },
  },
} as const;

type LoadedThread = Prisma.ThreadGetPayload<{ include: typeof THREAD_INCLUDE }>;

/**
 * Whether this viewer belongs to this thread at all.
 *
 * A stranger gets the same answer as a missing thread, so a thread id in a URL
 * cannot be used to discover which conversations exist.
 */
function belongsTo(thread: LoadedThread, viewer: Viewer): boolean {
  if (viewer.role === "admin") return true;
  if (viewer.role === "buyer") return thread.buyerId === viewer.id;
  return thread.item.sellerId === viewer.id;
}

/** Which stored messages this viewer may read. */
function readable(visibility: MessageVisibility, viewer: Viewer, isSender: boolean): boolean {
  if (viewer.role === "admin") return true;
  if (visibility === "both") return true;
  // A sender always keeps sight of what they wrote, including a withheld
  // message: nothing is silently destroyed.
  if (isSender) return true;
  if (viewer.role === "buyer") return visibility === "buyer_and_admin";
  return visibility === "seller_and_admin";
}

/**
 * Drop everything the viewer must not have.
 *
 * The admin sees names. Nobody else sees a name, an id, an email or a phone
 * number: a counterparty is "a buyer" or "the seller" and nothing more.
 */
function serialise(thread: LoadedThread, viewer: Viewer, after?: string): RelayThread {
  let messages = thread.messages.filter((message) =>
    readable(message.visibleTo, viewer, message.senderId === viewer.id),
  );

  if (after) {
    const index = messages.findIndex((message) => message.id === after);
    if (index >= 0) messages = messages.slice(index + 1);
  }

  return {
    id: thread.id,
    itemId: thread.item.id,
    itemTitle: thread.item.title,
    status: thread.status,
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      from:
        viewer.role === "admin"
          ? message.sender.firstName
          : message.senderId === viewer.id
            ? "you"
            : // A direct thread exists because a deposit was paid, so the two
              // parties are no longer strangers and a first name is right.
              // A relay thread names nobody.
              thread.threadType === "direct"
              ? message.sender.firstName
              : message.sender.role === "buyer"
                ? "a buyer"
                : message.sender.role === "seller"
                  ? "the seller"
                  : "Declutter",
      mine: message.senderId === viewer.id,
      ...(viewer.role === "admin" ? { visibleTo: message.visibleTo } : {}),
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

async function loadThread(threadId: string) {
  return prisma.thread.findUnique({ where: { id: threadId }, include: THREAD_INCLUDE });
}

/** Read one thread, masked for this viewer. `after` limits it to what is new. */
export async function getThread(
  threadId: string,
  viewer: Viewer,
  after?: string,
): Promise<ThreadResult> {
  const thread = await loadThread(threadId);

  if (!thread || !belongsTo(thread, viewer)) return { ok: false, reason: "not_found" };

  return { ok: true, thread: serialise(thread, viewer, after) };
}

/**
 * Post a message, opening the buyer's thread for this item if there is none.
 *
 * A seller posts into an existing thread; only a buyer can start one, because
 * a relay thread is owned by the person who asked.
 */
export async function postMessage(
  sender: Viewer,
  input: MessageInput,
): Promise<ThreadResult> {
  if ("threadId" in input) {
    const thread = await loadThread(input.threadId);
    if (!thread || !belongsTo(thread, sender)) return { ok: false, reason: "not_found" };

    // A locked thread keeps its history and takes nothing new: a relay closed
    // because the conversation moved on, or a completed handover.
    if (thread.status === "locked") return { ok: false, reason: "locked" };

    await writeMessage(thread.id, sender, input.body, thread.threadType);
    return reload(thread.id, sender);
  }

  if (sender.role !== "buyer") return { ok: false, reason: "not_found" };

  // Only a listed item can be asked about: a conversation about something
  // nobody can buy has nowhere to go. A missing item and an unavailable one
  // are the same answer, as they are on the detail page.
  const item = await prisma.item.findFirst({
    where: { id: input.itemId, status: "listed" },
    select: { id: true },
  });

  if (!item) return { ok: false, reason: "item_unavailable" };

  const existing = await prisma.thread.findFirst({
    where: { itemId: item.id, buyerId: sender.id, threadType: "relay" },
    select: { id: true },
  });

  if (existing) {
    await writeMessage(existing.id, sender, input.body);
    return reload(existing.id, sender);
  }

  try {
    const thread = await prisma.thread.create({
      data: {
        itemId: item.id,
        buyerId: sender.id,
        threadType: "relay",
        status: "open",
        messages: {
          create: {
            senderId: sender.id,
            body: input.body,
            visibleTo: INITIAL_VISIBILITY.buyer,
          },
        },
      },
      select: { id: true },
    });

    return reload(thread.id, sender);
  } catch (error) {
    // The partial unique index refused a second relay thread: another request
    // opened one first. Continue that thread rather than failing the message.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.thread.findFirst({
        where: { itemId: item.id, buyerId: sender.id, threadType: "relay" },
        select: { id: true },
      });

      if (!raced) return { ok: false, reason: "conflict" };

      await writeMessage(raced.id, sender, input.body);
      return reload(raced.id, sender);
    }

    throw error;
  }
}

async function writeMessage(
  threadId: string,
  sender: Viewer,
  text: string,
  threadType: "relay" | "direct" = "relay",
) {
  await prisma.message.create({
    data: {
      threadId,
      senderId: sender.id,
      body: text,
      // Addressed by the server from the thread type and the sender's role,
      // never from the request.
      //
      // A direct thread exists because a deposit was paid, so its messages are
      // visible to both parties at once: the two are committed to a handover
      // and queuing their messages for review would obstruct rather than
      // mediate. The admin still reads everything (MSG-7).
      visibleTo:
        threadType === "direct"
          ? "both"
          : sender.role === "buyer"
            ? INITIAL_VISIBILITY.buyer
            : sender.role === "seller"
              ? INITIAL_VISIBILITY.seller
              : "both",
    },
  });
}

async function reload(threadId: string, viewer: Viewer): Promise<ThreadResult> {
  const thread = await loadThread(threadId);
  if (!thread) return { ok: false, reason: "not_found" };
  return { ok: true, thread: serialise(thread, viewer) };
}

export type ModerationResult =
  | { ok: true; visibleTo: MessageVisibility }
  | { ok: false; reason: "not_found" };

/** Relay or withhold one message. Admin only, checked by the route's guard. */
export async function moderateMessage(
  messageId: string,
  action: "relay" | "withhold",
): Promise<ModerationResult> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true },
  });

  if (!message) return { ok: false, reason: "not_found" };

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { visibleTo: MODERATION[action] },
    select: { visibleTo: true },
  });

  return { ok: true, visibleTo: updated.visibleTo };
}
