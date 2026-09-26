/**
 * The cart page.
 *
 * A server shell only. The cart itself lives in localStorage, so its contents
 * cannot be known until the browser reads them: everything is rendered by
 * `CartView` from the response to `POST /api/cart`.
 */

import type { Metadata } from "next";

import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Your cart · Declutter",
};

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#12142B] sm:text-[26px]">
          Your cart
        </h1>
        <p className="text-[13px] text-[#6B6E84]">
          Prices and availability are re-checked every time this page loads.
        </p>
      </header>

      <CartView />
    </main>
  );
}
