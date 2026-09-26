/**
 * The buyer's orders.
 *
 * Until authentication lands this is the seeded demo buyer's list, resolved
 * through `getActingBuyer` like every other buyer-facing read.
 */

import type { Metadata } from "next";

import { getActingBuyer } from "@/lib/acting-buyer";
import { getBuyerOrderList } from "@/lib/orders";
import { OrderList } from "./order-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your orders · Declutter",
};

export default async function OrdersPage() {
  const buyer = await getActingBuyer();
  const orders = await getBuyerOrderList(buyer.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#12142B] sm:text-[30px]">
          Your orders
        </h1>
        <p className="text-sm leading-relaxed text-[#6B6E84]">
          Items you have reserved with a deposit. Declutter holds your money until the
          handover, and each item is held for 72 hours.
        </p>
      </header>

      <OrderList orders={orders} />
    </main>
  );
}
