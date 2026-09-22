/**
 * Offering an item. SELL-1, SELL-2.
 *
 * A seller states the payout they want to receive. They do not set a price:
 * the admin does that at approval, and the difference is the platform margin
 * (PRD §6). Any interface copy calling the seller's figure a price would
 * misrepresent the model.
 *
 * `listedPrice` is not nullable, and at submission nobody has priced anything,
 * so the requested payout is written to both columns as a provisional value.
 * It is never shown and never used in a total: every buyer-facing read filters
 * on `status = listed`, and this item is `pending_review`. Slice 09 overwrites
 * it. The alternative, a nullable price column, would spread a null through
 * pricing code that is currently total, to represent a state that lasts only
 * until the admin opens the queue.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

/** Attacker-controlled: these arrive as multipart form fields. */
export const submissionSchema = z.object({
  title: z.string().trim().min(3, { error: "Give the item a title" }).max(120),
  // Multipart encodes a textarea's newlines as CRLF, so they are normalised
  // here. Otherwise identical text would be stored differently depending on
  // how it arrived, and the rendered paragraphs would carry stray characters.
  description: z
    .string()
    .trim()
    .transform((value) => value.replace(/\r\n/g, "\n"))
    .pipe(z.string().min(10, { error: "Describe the item" }).max(4000)),
  category: z.enum(["electronics", "furniture", "appliances", "fashion", "books", "other"]),
  condition: z.enum(["like_new", "good", "fair"]),
  // Money as a string, validated to whole Naira or two decimal places, never
  // parsed as a float.
  requestedPayout: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, { error: "Enter an amount, for example 45000" })
    .refine((value) => Number(value) > 0, { error: "Enter an amount above zero" }),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export type SubmittedItem = {
  id: string;
  title: string;
  status: string;
  requestedPayout: string;
};

/**
 * Create a submission and its images together.
 *
 * `status`, `sellerId`, `listedPrice` and `approvedById` are set here and are
 * never read from the request, so a crafted body cannot publish an item, price
 * it, or attribute it to another seller.
 */
export async function createSubmission(
  sellerId: string,
  input: SubmissionInput,
  imageUrls: readonly string[],
): Promise<SubmittedItem> {
  const payout = new Prisma.Decimal(input.requestedPayout);

  const item = await prisma.item.create({
    data: {
      sellerId,
      title: input.title,
      description: input.description,
      category: input.category,
      condition: input.condition,
      sellerPayoutAmount: payout,
      // Provisional, and unreachable while the item is pending_review.
      listedPrice: payout,
      status: "pending_review",
      images: {
        create: imageUrls.map((url, index) => ({ url, sortOrder: index })),
      },
    },
  });

  return {
    id: item.id,
    title: item.title,
    status: item.status,
    requestedPayout: item.sellerPayoutAmount.toString(),
  };
}

/** A row in the seller's own submissions list. */
export type SellerSubmission = {
  id: string;
  title: string;
  status: string;
  category: string;
  condition: string;
  requestedPayout: string;
  /** Null until an admin has priced it above the payout. */
  listedPrice: string | null;
  rejectionReason: string | null;
  thumbnail: string | null;
  createdAt: string;
};

/**
 * Everything this seller has offered, newest first. SELL-2.
 *
 * Scoped to the seller's own id, which comes from the session and never from a
 * URL, so one seller cannot survey another's stock.
 */
export async function getSellerSubmissions(sellerId: string): Promise<SellerSubmission[]> {
  const items = await prisma.item.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      condition: true,
      sellerPayoutAmount: true,
      listedPrice: true,
      rejectionReason: true,
      createdAt: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  return items.map((item) => {
    const payout = item.sellerPayoutAmount.toString();
    const price = item.listedPrice.toString();

    return {
      id: item.id,
      title: item.title,
      status: item.status,
      category: item.category,
      condition: item.condition,
      requestedPayout: payout,
      // While the two are equal the item has not been priced, so there is no
      // public price to show and the provisional figure stays hidden.
      listedPrice: price === payout ? null : price,
      rejectionReason: item.rejectionReason,
      thumbnail: item.images[0]?.url ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  });
}
