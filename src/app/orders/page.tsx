/**
 * A buyer's orders.
 *
 * Scoped to the signed-in buyer, so a reservation is findable without a link
 * and nobody else's is reachable at all.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getBuyerOrderList } from "@/lib/orders";
import { getSessionUser } from "@/lib/session";
import { OrderList } from "./order-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your orders · Declutter",
};

export default async function OrdersPage() {
  const user = await getSessionUser();

  if (!user) redirect("/signin?next=/orders");

  const orders = await getBuyerOrderList(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Your orders
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
          Items you have reserved with a deposit. Each one has the seller&rsquo;s details and a
          conversation for arranging collection.
        </p>
      </header>

      <OrderList
        orders={orders}
        emptyMessage="You have not reserved anything yet."
        emptyAction={{ href: "/", label: "Browse the marketplace" }}
      />
    </main>
  );
}
