"use client";

/**
 * Site header with the cart indicator.
 *
 * The badge count comes from `CartProvider`, which keeps it current by posting
 * the cart to `/api/cart`. Adding an item updates it in place, with no reload.
 */

import Link from "next/link";

import { useCart } from "./cart-provider";

export function Header() {
  const { count, summary, ready } = useCart();
  const unavailable = summary?.unavailableCount ?? 0;

  return (
    <header className="border-b border-[#DDDEE9] bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-12">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tracking-[-0.01em] text-[#12142B] sm:text-xl">
            Declutter
          </span>
          <span className="hidden font-mono text-[11px] text-[#6B6E84] sm:inline">
            marketplace
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-7">
          <Link
            href="/orders"
            className="hidden text-sm text-[#6B6E84] hover:text-[#12142B] sm:inline"
          >
            Orders
          </Link>

          <Link
            href="/cart"
            className="flex min-h-11 items-center gap-2 rounded border border-[#2A2D64] px-3 sm:px-3.5"
            aria-label={
              ready ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#12142B"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>

            <span className="hidden text-[13px] font-semibold text-[#12142B] sm:inline">
              Cart
            </span>

            {/* aria-live so a screen reader hears the count change after an add,
                without the whole header being announced again. */}
            <span
              aria-live="polite"
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-medium ${
                count > 0 ? "bg-[#E8A33D] text-[#12142B]" : "bg-[#EDEEF6] text-[#6B6E84]"
              }`}
            >
              {/* Render 0 until storage has been read, so the server and client
                  markup match and hydration does not warn. */}
              {ready ? count : 0}
            </span>

            {unavailable > 0 && (
              <span
                title={`${unavailable} ${unavailable === 1 ? "item is" : "items are"} no longer available`}
                aria-label={`${unavailable} no longer available`}
                className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#FCF3E3] text-[11px] font-semibold text-[#6B4A12]"
              >
                !
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
