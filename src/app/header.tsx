"use client";

/**
 * Site header with the cart indicator.
 *
 * The badge count comes from `CartProvider`, which keeps it current by posting
 * the cart to `/api/cart`. Adding an item updates it in place, with no reload.
 */

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { useCart } from "./cart-provider";

export function Header() {
  const { count, summary, ready } = useCart();
  const { data: session, status } = useSession();
  const unavailable = summary?.unavailableCount ?? 0;

  return (
    <header className="border-b border-[#B4B4B4] bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-12">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tracking-[-0.01em] text-[#1F1F1F] sm:text-xl">
            Declutter
          </span>
          <span className="hidden font-mono text-[11px] text-[#6B6B6B] sm:inline">
            marketplace
          </span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          {/* Nothing is rendered while the session is loading, so the markup
              does not disagree with the server on the first paint. */}
          {/* Role-aware: an account is never offered an action it cannot
              take. Hiding the link is not the access control, though — both
              destinations guard server-side as well (AUTH-6). */}
          {status === "authenticated" && session?.user?.role === "buyer" && (
            <>
              <Link
                href="/orders"
                className="hidden text-sm text-[#1F1F1F] hover:underline sm:inline"
              >
                Orders
              </Link>
              <Link
                href="/enquiries"
                className="hidden text-sm text-[#1F1F1F] hover:underline sm:inline"
              >
                Enquiries
              </Link>
            </>
          )}

          {status === "authenticated" && session?.user?.role === "seller" && (
            <>
              <Link
                href="/sell/orders"
                className="hidden text-sm text-[#1F1F1F] hover:underline sm:inline"
              >
                Reserved
              </Link>
              <Link
                href="/sell"
                className="text-sm font-medium text-[#1E5F4B] hover:underline"
              >
                Sell an item
              </Link>
            </>
          )}

          {status === "authenticated" && session?.user?.role === "admin" && (
            <Link
              href="/admin"
              className="text-sm font-medium text-[#1E5F4B] hover:underline"
            >
              Review queue
            </Link>
          )}

          {status === "authenticated" && session?.user ? (
            <span className="flex items-center gap-2 sm:gap-3">
              {/* User-supplied. React escapes it. */}
              <span className="hidden max-w-[12ch] truncate text-sm text-[#1F1F1F] sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="min-h-11 text-sm text-[#6B6B6B] underline hover:text-[#1F1F1F]"
              >
                Sign out
              </button>
            </span>
          ) : status === "unauthenticated" ? (
            <span className="flex items-center gap-3 sm:gap-4">
              <Link href="/signin" className="text-sm text-[#1F1F1F] hover:underline">
                Sign in
              </Link>
              <Link
                href="/register"
                className="hidden text-sm text-[#1E5F4B] underline sm:inline"
              >
                Register
              </Link>
            </span>
          ) : null}

          <Link
            href="/cart"
            className="flex min-h-11 items-center gap-2 rounded border border-[#1E5F4B] px-3 sm:px-3.5"
            aria-label={
              ready ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1F1F1F"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>

            <span className="hidden text-[13px] font-semibold text-[#1F1F1F] sm:inline">
              Cart
            </span>

            {/* aria-live so a screen reader hears the count change after an add,
                without the whole header being announced again. */}
            <span
              aria-live="polite"
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-medium ${
                count > 0 ? "bg-[#1E5F4B] text-white" : "bg-[#E8E8E8] text-[#6B6B6B]"
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
                className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#FDF6E8] text-[11px] font-semibold text-[#8A6D2F]"
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
