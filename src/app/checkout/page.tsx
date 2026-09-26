/**
 * Checkout. BUY-7.
 *
 * A server shell only. The cart lives in localStorage, so everything is
 * rendered by `CheckoutView` once the browser has read it.
 */

import type { Metadata } from "next";

import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = {
  title: "Checkout · Declutter",
};

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#12142B] sm:text-[26px]">
          Pay deposit
        </h1>
        <p className="text-[13px] text-[#6B6E84]">
          Read the refund terms, then reserve your items with a 10% deposit.
        </p>
      </header>

      <CheckoutView />
    </main>
  );
}
