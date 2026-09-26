"use client";

/**
 * The cart page.
 *
 * Every figure here comes from `POST /api/cart`, resolved server-side against
 * current rows. Nothing is computed in the browser and nothing is read from
 * storage except the identifiers.
 *
 * The unavailable line is the case that matters, BUY-6: an item reserved or
 * sold while the buyer was browsing stays visible so they can see what
 * happened and remove it, but is struck through, excluded from every total,
 * and cannot be checked out.
 */

import Image from "next/image";
import Link from "next/link";

import { useCart } from "@/app/cart-provider";
import { CATEGORY_LABELS, CONDITION_LABELS, type Category } from "@/lib/item-query";
import { formatNaira } from "@/lib/pricing";
import type { CartLine } from "@/lib/cart-summary";

export function CartView() {
  const { summary, loading, error, ready, remove } = useCart();

  // Before storage has been read, say nothing rather than flashing "empty".
  if (!ready || (!summary && loading)) {
    return <p className="mt-8 text-sm text-[#6B6E84]">Loading your cart…</p>;
  }

  const lines = summary?.lines ?? [];

  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded border border-dashed border-[#DDDEE9] p-10 text-center">
        <p className="text-sm font-medium text-[#12142B]">Your cart is empty</p>
        <p className="mt-1.5 text-[13px] text-[#6B6E84]">
          Items you add will appear here, held for 72 hours once you pay a deposit.
        </p>
        <Link href="/" className="mt-4 inline-block text-[13px] text-[#2A2D64] underline">
          Browse the marketplace
        </Link>
      </div>
    );
  }

  const available = summary?.availableCount ?? 0;
  const unavailable = summary?.unavailableCount ?? 0;

  return (
    <div className="mt-6 flex flex-col items-start gap-8 lg:flex-row lg:gap-10">
      <ul className="flex w-full flex-col gap-4">
        {lines.map((line) => (
          <CartRow key={line.id} line={line} onRemove={() => remove(line.id)} />
        ))}
      </ul>

      {/* Beside the list on desktop, below it on phone. */}
      <aside className="flex w-full flex-none flex-col gap-4 rounded-lg border border-[#DDDEE9] bg-white p-5 lg:w-[340px]">
        <h2 className="text-base font-semibold text-[#12142B]">Summary</h2>

        {error && (
          <p className="rounded border border-[#E8A33D] bg-[#FCF3E3] p-2.5 text-xs leading-relaxed text-[#6B4A12]">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[#6B6E84]">
              {available} {available === 1 ? "item" : "items"} available
            </span>
            <span className="font-mono text-[13px] text-[#12142B]">
              {formatNaira(summary?.priceTotal ?? "0")}
            </span>
          </div>
          {unavailable > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-[#6B6E84]">
                {unavailable} {unavailable === 1 ? "item" : "items"} unavailable
              </span>
              <span className="font-mono text-[13px] text-[#6B6E84]">not included</span>
            </div>
          )}
        </div>

        <div className="h-px bg-[#DDDEE9]" />

        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-[#12142B]">Deposit due today</span>
            <span className="text-xl font-semibold text-[#12142B]">
              {formatNaira(summary?.depositTotal ?? "0")}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[#6B6E84]">Balance on collection</span>
            <span className="font-mono text-[13px] text-[#6B6E84]">
              {formatNaira(summary?.balanceTotal ?? "0")}
            </span>
          </div>
        </div>

        {/* Checkout is all or nothing, so any unavailable line blocks it. */}
        {available > 0 && unavailable === 0 ? (
          <Link
            href="/checkout"
            className="flex h-12 items-center justify-center rounded bg-[#E8A33D] text-[15px] font-semibold text-[#12142B] hover:opacity-90"
          >
            Proceed to checkout
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="flex h-12 items-center justify-center rounded bg-[#E8A33D] text-[15px] font-semibold text-[#12142B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Proceed to checkout
            </button>
            <p className="text-center text-xs text-[#6B6E84]">
              {available === 0
                ? "Nothing in your cart is currently available."
                : "Remove unavailable items to continue."}
            </p>
          </>
        )}

        <p className="text-xs leading-relaxed text-[#6B6E84]">
          Each item becomes its own order. Unavailable items are never charged for.
        </p>
      </aside>
    </div>
  );
}

function CartRow({ line, onRemove }: { line: CartLine; onRemove: () => void }) {
  const gone = !line.available;

  return (
    <li
      className={`flex flex-col gap-3 rounded-lg border border-[#DDDEE9] bg-white p-4 sm:flex-row sm:gap-[18px] ${
        gone ? "bg-[#F4F4F8]" : ""
      }`}
    >
      <div
        className={`relative h-[100px] w-full flex-none overflow-hidden rounded-[3px] bg-[#EDEEF6] sm:w-[140px] ${
          gone ? "opacity-55" : ""
        }`}
      >
        {line.thumbnail && (
          <Image
            src={line.thumbnail}
            alt={line.title}
            fill
            sizes="140px"
            className="object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        {line.category && (
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.06em] ${
              gone ? "text-[#8B8EA1]" : "text-[#6B6E84]"
            }`}
          >
            {CATEGORY_LABELS[line.category as Category] ?? line.category}
          </span>
        )}

        {/* Available items link to their page; a gone item has nothing to show. */}
        {gone ? (
          <span className="text-base font-semibold text-[#8B8EA1]">{line.title}</span>
        ) : (
          <Link
            href={`/items/${line.id}`}
            className="text-base font-semibold text-[#12142B] hover:underline"
          >
            {line.title}
          </Link>
        )}

        {line.condition && !gone && (
          <span className="text-[13px] text-[#6B6E84]">
            Condition: {CONDITION_LABELS[line.condition] ?? line.condition}
          </span>
        )}

        {gone && (
          <div className="mt-0.5 flex items-center gap-1.5">
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="#6B6E84" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16.5v.01" />
            </svg>
            <span className="text-[13px] font-medium text-[#12142B]">
              {line.unavailableReason}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-none items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-between">
        <div className="flex items-baseline gap-2.5 sm:flex-col sm:items-end sm:gap-1">
          {line.listedPrice && (
            <span
              className={`text-lg font-semibold ${
                gone ? "text-[#8B8EA1] line-through" : "text-[#12142B]"
              }`}
            >
              {formatNaira(line.listedPrice)}
            </span>
          )}
          {!gone && line.deposit && (
            <span className="font-mono text-[11px] text-[#6B6E84]">
              {formatNaira(line.deposit)} deposit
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 text-xs text-[#12142B] underline hover:text-[#6B6E84]"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
