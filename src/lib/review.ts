/**
 * Admin curation. ADMIN-1 to ADMIN-4.
 *
 * Approval is the act that prices an item. A seller states the payout they
 * want; the admin sets the public price; the difference is the platform margin
 * (PRD §6). The two figures are stored independently and are never derived
 * from each other by percentage, so pricing writes `listedPrice` and never
 * touches `sellerPayoutAmount`.
 *
 * The margin rule is the slice's central invariant: the price must exceed the
 * payout the row already carries. It is checked against the stored figure and
 * never against anything in the request, because an admin who could supply the
 * payout could publish a listing the platform is obliged to lose money on.
 *
 * Slice 08 wrote the requested payout to `listedPrice` provisionally, which is
 * why an unreviewed item has the two columns equal. Approval is what makes
 * them differ, and what makes the price real.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { applyTrigger, type ItemStatus } from "@/lib/item-state";
import { prisma } from "@/lib/prisma";

/** Money as a string, whole Naira or two decimal places. Never a float. */
const amount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, { error: "Enter an amount, for example 52000" });

/**
 * The decision, as it arrives from the review form.
 *
 * A discriminated union rather than one object with optional fields: a
 * rejection has no price and an approval has no reason, and expressing that in
 * the schema means the route never has to ask which fields to trust.
 *
 * `sellerPayoutAmount`, `status` and `approvedById` are absent by design. Zod
 * drops unknown keys, so a request carrying them changes nothing.
 */
export const reviewSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    title: z.string().trim().min(3, { error: "Give the listing a title" }).max(120),
    description: z
      .string()
      .trim()
      .transform((value) => value.replace(/\r\n/g, "\n"))
      .pipe(z.string().min(10, { error: "Describe the item" }).max(4000)),
    listedPrice: amount,
  }),
  z.object({
    decision: z.literal("reject"),
    // A seller is never left with an unexplained refusal.
    reason: z
      .string()
      .trim()
      .min(10, { error: "Give the seller a reason they can act on" })
      .max(500),
  }),
]);

export type ReviewInput = z.infer<typeof reviewSchema>;

export type ReviewOutcome =
  | { ok: true; item: { id: string; status: ItemStatus; listedPrice: string } }
  | { ok: false; status: 400 | 404 | 409; reason: string; field?: string };

/**
 * Decide one submission.
 *
 * Returns a refusal rather than throwing, the same choice `applyTrigger` and
 * `requireUser` make: a thrown error reads as a 500, and none of these cases
 * is a bug.
 *
 * The write is conditional on the status the decision was made against, so two
 * admins acting on the same stale queue page cannot both succeed. The loser
 * gets a 409 and the published listing is not overwritten.
 */
export async function reviewSubmission(
  adminId: string,
  itemId: string,
  input: ReviewInput,
): Promise<ReviewOutcome> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, status: true, sellerPayoutAmount: true },
  });

  if (!item) {
    return { ok: false, status: 404, reason: "That submission no longer exists." };
  }

  const trigger = input.decision === "approve" ? "admin_approves" : "admin_rejects";
  const transition = applyTrigger(item.status, trigger);

  if (!transition.ok) {
    return {
      ok: false,
      status: 409,
      reason: `This submission has already been decided (${item.status}).`,
    };
  }

  // Unchecked, because `approvedById` is a foreign key and the checked input
  // would only accept it as a nested `approvedBy: { connect: ... }`.
  const data: Prisma.ItemUncheckedUpdateManyInput = { approvedById: adminId };

  if (input.decision === "approve") {
    const price = new Prisma.Decimal(input.listedPrice);

    // Checked against the row, never against the request.
    if (price.lessThanOrEqualTo(item.sellerPayoutAmount)) {
      return {
        ok: false,
        status: 400,
        field: "listedPrice",
        reason: `The price must be above the seller's payout of ₦${item.sellerPayoutAmount.toString()}.`,
      };
    }

    data.title = input.title;
    data.description = input.description;
    data.listedPrice = price;
    data.status = transition.to;
    // A previous reason would be stale on a published listing.
    data.rejectionReason = null;
  } else {
    data.status = transition.to;
    data.rejectionReason = input.reason;
  }

  // `updateMany` so the status can be part of the WHERE clause: the row moves
  // only if it is still in the state the decision was made against. A plain
  // `update` would overwrite whatever another admin had just written.
  const { count } = await prisma.item.updateMany({
    where: { id: itemId, status: item.status },
    data,
  });

  if (count === 0) {
    return {
      ok: false,
      status: 409,
      reason: "Another administrator decided this submission first.",
    };
  }

  const updated = await prisma.item.findUniqueOrThrow({
    where: { id: itemId },
    select: { id: true, status: true, listedPrice: true },
  });

  return {
    ok: true,
    item: {
      id: updated.id,
      status: updated.status,
      listedPrice: updated.listedPrice.toString(),
    },
  };
}

/** A row in the admin's queue: enough to choose what to open next. */
export type QueueRow = {
  id: string;
  title: string;
  category: string;
  condition: string;
  requestedPayout: string;
  sellerName: string;
  thumbnail: string | null;
  submittedAt: string;
};

/**
 * Everything awaiting a decision, longest wait first. ADMIN-1.
 *
 * Oldest first is a fairness rule, not a display preference: a seller who
 * submitted a week ago should not wait behind one who submitted this morning.
 *
 * The seller and the thumbnail come back in the same query as the item. A
 * queue of twenty rows fetching each separately is twenty extra round trips,
 * which is the `data-n-plus-one` rule the catalogue already follows.
 */
export async function getReviewQueue(): Promise<QueueRow[]> {
  const items = await prisma.item.findMany({
    where: { status: "pending_review" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      category: true,
      condition: true,
      sellerPayoutAmount: true,
      createdAt: true,
      seller: { select: { firstName: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    condition: item.condition,
    requestedPayout: item.sellerPayoutAmount.toString(),
    sellerName: item.seller.firstName,
    thumbnail: item.images[0]?.url ?? null,
    submittedAt: item.createdAt.toISOString(),
  }));
}

/** The full submission, as the review page shows it. */
export type SubmissionForReview = QueueRow & {
  description: string;
  images: string[];
};

/**
 * One submission, or null.
 *
 * Scoped to `pending_review`, so a decided item cannot be reopened by editing
 * the URL. That keeps the terminal statuses terminal without the review page
 * having to reason about them.
 */
export async function getSubmissionForReview(
  itemId: string,
): Promise<SubmissionForReview | null> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, status: "pending_review" },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      condition: true,
      sellerPayoutAmount: true,
      createdAt: true,
      seller: { select: { firstName: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!item) return null;

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    condition: item.condition,
    requestedPayout: item.sellerPayoutAmount.toString(),
    sellerName: item.seller.firstName,
    thumbnail: item.images[0]?.url ?? null,
    images: item.images.map((image) => image.url),
    submittedAt: item.createdAt.toISOString(),
  };
}
