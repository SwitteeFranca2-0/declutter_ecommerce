/**
 * Pieces the cart and checkout pages share, so the two cannot drift apart.
 *
 * Both render figures from `POST /api/cart` as they arrive; nothing here
 * computes a price.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { formatNaira } from "@/lib/pricing";

/** The empty state. The sentence underneath says what the page would have shown. */
export function EmptyCart({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 rounded border border-dashed border-[#DDDEE9] p-10 text-center">
      <p className="text-sm font-medium text-[#12142B]">Your cart is empty</p>
      <p className="mt-1.5 text-[13px] text-[#6B6E84]">{children}</p>
      <Link href="/" className="mt-4 inline-block text-[13px] text-[#2A2D64] underline">
        Browse the marketplace
      </Link>
    </div>
  );
}

/** What is paid now and what is left, the two figures every summary ends on. */
export function DepositTotals({ deposit, balance }: { deposit: string; balance: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[#12142B]">Deposit due today</span>
        <span className="text-xl font-semibold text-[#12142B]">{formatNaira(deposit)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-[#6B6E84]">Balance on collection</span>
        <span className="font-mono text-[13px] text-[#6B6E84]">{formatNaira(balance)}</span>
      </div>
    </div>
  );
}
