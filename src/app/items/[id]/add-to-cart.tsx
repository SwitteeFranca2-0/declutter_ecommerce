"use client";

/**
 * Add to cart, on the item detail page.
 *
 * Gives visible confirmation rather than silently succeeding: the button
 * changes state and the header badge increments at the same moment.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/app/cart-provider";

export function AddToCart({ itemId }: { itemId: string }) {
  const { add, contains, ready } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const inCart = ready && contains(itemId);

  function handleAdd() {
    add(itemId);
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 4000);
  }

  if (inCart) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex h-12 items-center justify-center gap-2 rounded border border-[#1E5F4B] bg-[#F4F8F6]">
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#1E5F4B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 5 5L19 7" />
          </svg>
          <span className="text-[15px] font-semibold text-[#1E5F4B]">In your cart</span>
        </div>
        <Link
          href="/cart"
          className="flex h-12 items-center justify-center rounded border border-[#B4B4B4] text-[15px] font-medium text-[#1F1F1F] hover:border-[#6B6B6B]"
        >
          Go to cart
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={handleAdd}
        disabled={!ready}
        className="flex h-12 items-center justify-center rounded bg-[#1E5F4B] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add to cart
      </button>
      {/* Announced to screen readers as well as shown. */}
      <p aria-live="polite" className="min-h-4 text-center text-xs text-[#6B6B6B]">
        {justAdded ? "Added to your cart" : ""}
      </p>
    </div>
  );
}
