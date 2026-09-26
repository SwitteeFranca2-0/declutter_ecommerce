/**
 * A seller's reserved items.
 *
 * Orders on this seller's own items, so they can see what has been reserved
 * and get into each conversation to arrange a handover.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSellerOrderList } from "@/lib/orders";
import { getSessionUser } from "@/lib/session";
import { OrderList } from "@/app/orders/order-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserved items · Declutter",
};

export default async function SellerOrdersPage() {
  const user = await getSessionUser();

  if (!user) redirect("/signin?next=/sell/orders");
  // Checked here as well as on every route this page calls: hiding a link is
  // not access control (AUTH-6).
  if (user.role !== "seller") redirect("/");

  const orders = await getSellerOrderList(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/sell" className="text-sm text-[#1E5F4B] hover:underline">
        Back to selling
      </Link>

      <header className="mt-4 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Reserved items
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
          A buyer has paid a deposit on each of these, so Declutter is holding their money.
          Arrange the handover in the conversation attached to the order.
        </p>
      </header>

      <OrderList
        orders={orders}
        emptyMessage="Nothing of yours is reserved yet."
        emptyAction={{ href: "/sell", label: "Offer another item" }}
      />
    </main>
  );
}
