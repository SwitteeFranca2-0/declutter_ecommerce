/**
 * An item that exists but cannot be bought.
 *
 * Shown instead of the buy panel when a link outlives the listing: from a
 * cart, a bookmark, or a tab open since yesterday. The buyer sees **which**
 * item went and why, which the old generic page could not tell them.
 *
 * Everything here is read-only. The gallery and the copy stay; the price is
 * struck through and the actions are gone, so there is nothing to click that
 * would fail.
 */

import Image from "next/image";
import Link from "next/link";

import type { ItemView } from "@/lib/items";
import { formatNaira } from "@/lib/pricing";
import { HOLD_DURATION_HOURS } from "@/lib/item-state";

const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electronics",
  furniture: "Furniture",
  appliances: "Appliances",
  fashion: "Fashion",
  books: "Books",
  other: "Other",
};

const CONDITION_LABELS: Record<string, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

/** What a buyer can usefully do about each reason. */
const WHAT_NEXT: Record<string, string> = {
  "Reserved by another buyer": `Another buyer has paid a deposit on this. Reservations lapse after ${HOLD_DURATION_HOURS} hours, so it may come back.`,
  Sold: "This one has been bought and collected. Similar items turn up often.",
  "No longer listed": "The seller withdrew it, or Declutter did not accept it for the marketplace.",
};

export function UnavailableItem({ item, reason }: { item: ItemView; reason: string }) {
  const thumbnail = item.images[0]?.url ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm font-medium text-[#2A2D64] hover:underline">
        Back to the marketplace
      </Link>

      <div className="mt-5 overflow-hidden rounded-lg border border-[#DDDEE9] bg-white">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
          <div className="relative h-[180px] w-full flex-none overflow-hidden rounded-md bg-[#EDEEF6] sm:h-[150px] sm:w-[200px]">
            {thumbnail && (
              <Image
                src={thumbnail}
                alt={item.title}
                fill
                sizes="200px"
                className="object-cover opacity-60 grayscale"
              />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2.5">
            {/* The state, said in three ways at once: a tag, a colour and
                words. Never colour alone. */}
            <span className="w-fit rounded-full bg-[#F4F4F8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B6E84]">
              Unavailable
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6E84]">
                {CATEGORY_LABELS[item.category] ?? item.category}
              </span>
              <span className="rounded border border-[#DDDEE9] px-[7px] py-0.5 text-[10px] text-[#6B6E84]">
                {CONDITION_LABELS[item.condition] ?? item.condition}
              </span>
            </div>

            {/* Seller-supplied. React escapes it. */}
            <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#12142B]">
              {item.title}
            </h1>

            <p className="text-lg font-semibold text-[#8B8EA1] line-through">
              {formatNaira(item.listedPrice)}
            </p>

            <p className="text-sm font-medium text-[#12142B]">{reason}</p>
            <p className="text-[13px] leading-relaxed text-[#6B6E84]">
              {WHAT_NEXT[reason] ?? "It is no longer on the marketplace."}
            </p>
          </div>
        </div>

        <div className="border-t border-[#DDDEE9] bg-[#F4F4F8] px-5 py-4 sm:px-6">
          <p className="text-[13px] leading-relaxed text-[#6B6E84]">
            Nothing has been charged, and anything still in your cart is unaffected.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className="flex h-11 items-center justify-center rounded-lg bg-[#E8A33D] px-5 text-[13px] font-semibold text-[#12142B]"
        >
          Find something similar
        </Link>
        <Link
          href="/cart"
          className="flex h-11 items-center justify-center rounded-lg border border-[#DDDEE9] bg-white px-5 text-[13px] text-[#12142B]"
        >
          Review your cart
        </Link>
      </div>

      <section aria-labelledby="description" className="mt-8">
        <h2 id="description" className="text-[15px] font-semibold text-[#12142B]">
          What it was
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#6B6E84]">
          {item.description}
        </p>
      </section>
    </main>
  );
}
