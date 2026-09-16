/**
 * Shown when an item does not exist, or is no longer listed.
 *
 * Deliberately the same page for both. Distinguishing them would tell a visitor
 * which item ids exist, and the buyer's next action is identical either way.
 */

import Link from "next/link";

export default function ItemNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6B6B]">
        Unavailable
      </span>

      <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F]">
        This item is no longer available
      </h1>

      <p className="text-sm leading-relaxed text-[#6B6B6B]">
        It may have been reserved by another buyer, sold, or withdrawn by the seller. Items
        return to the marketplace automatically if a reservation lapses, so it is worth
        checking back.
      </p>

      <Link
        href="/"
        className="mt-2 flex h-11 items-center justify-center rounded border border-[#B4B4B4] px-5 text-sm font-medium text-[#1F1F1F] hover:border-[#6B6B6B]"
      >
        Back to the marketplace
      </Link>
    </main>
  );
}
