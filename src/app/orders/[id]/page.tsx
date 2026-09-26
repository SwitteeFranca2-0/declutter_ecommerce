/**
 * One order. BUY-8, BUY-9.
 *
 * Everything about a reservation in one place: what was paid, what is still
 * owed, how long the item is held, who the other party is, and the direct
 * conversation opened when the deposit was recorded.
 *
 * What each party sees is decided in `getOrderFor`, not here. The buyer gets
 * the seller's name and phone because they have money at risk and are about to
 * travel to meet a stranger. The seller gets a first name, because the platform
 * holds the money and the item has not moved yet.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getOrderFor } from "@/lib/orders";
import { getThread } from "@/lib/relay";
import { formatNaira } from "@/lib/pricing";
import { getSessionUser } from "@/lib/session";
import { ThreadView } from "@/app/threads/[id]/thread-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order · Declutter",
};

const WHEN = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  if (!user) redirect(`/signin?next=/orders/${id}`);

  const order = await getOrderFor(id, user);

  // Not yours is indistinguishable from does not exist.
  if (!order) notFound();

  const thread = order.threadId ? await getThread(order.threadId, user) : null;
  const isBuyer = order.seller !== null && user.role !== "admin";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={user.role === "seller" ? "/sell/orders" : "/orders"}
        className="text-sm text-[#1E5F4B] hover:underline"
      >
        Back to your orders
      </Link>

      <header className="mt-4 flex flex-col gap-1.5">
        <span className="font-mono text-[11px] text-[#6B6B6B]">
          Order <span className="text-[#1F1F1F]">{order.reference}</span>
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F]">
          {order.itemTitle}
        </h1>
      </header>

      <section className="mt-5 flex flex-col gap-2.5 rounded border border-[#1E5F4B] bg-[#F4F8F6] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-[#6B6B6B]">Deposit paid</span>
          <span className="font-mono text-[13px] text-[#1F1F1F]">
            {formatNaira(order.depositAmount)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-[#1F1F1F]">Balance on collection</span>
          <span className="text-lg font-semibold text-[#1F1F1F]">
            {formatNaira(order.balanceAmount)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-[#6B6B6B]">Held until</span>
          <time dateTime={order.holdExpiresAt} className="font-mono text-[13px] text-[#6B6B6B]">
            {WHEN.format(new Date(order.holdExpiresAt))}
          </time>
        </div>
      </section>

      {/* BUY-8: released by the deposit, and only to the buyer who paid it. */}
      {order.seller && (
        <section className="mt-4 flex flex-col gap-1.5 rounded border border-[#B4B4B4] p-4">
          <h2 className="text-[15px] font-semibold text-[#1F1F1F]">Your seller</h2>
          <p className="text-sm text-[#1F1F1F]">
            {order.seller.firstName},{" "}
            <a href={`tel:${order.seller.phone}`} className="font-mono text-[#1E5F4B] underline">
              {order.seller.phone}
            </a>
          </p>
          <p className="text-xs leading-relaxed text-[#6B6B6B]">
            Their details unlocked when you paid the deposit. Declutter holds your money until
            you have the item, so arrange the handover below and pay the balance before you
            travel.
          </p>
        </section>
      )}

      {order.buyer && (
        <section className="mt-4 flex flex-col gap-1.5 rounded border border-[#B4B4B4] p-4">
          <h2 className="text-[15px] font-semibold text-[#1F1F1F]">Your buyer</h2>
          <p className="text-sm text-[#1F1F1F]">{order.buyer.firstName}</p>
          <p className="text-xs leading-relaxed text-[#6B6B6B]">
            Declutter holds their deposit, so you arrange the handover here rather than by
            phone. Their contact details stay with Declutter.
          </p>
        </section>
      )}

      <section aria-labelledby="conversation" className="mt-8">
        <h2 id="conversation" className="text-base font-semibold text-[#1F1F1F]">
          Arrange the handover
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">
          {isBuyer
            ? "You are talking to the seller directly now. Messages are not reviewed before they arrive."
            : "You are talking to the buyer directly. Messages are not reviewed before they arrive."}
        </p>

        {thread?.ok ? (
          <ThreadView initial={thread.thread} isAdmin={false} canReply />
        ) : (
          <p className="mt-4 rounded border border-dashed border-[#B4B4B4] p-6 text-center text-[13px] text-[#6B6B6B]">
            No conversation is attached to this order.
          </p>
        )}
      </section>
    </main>
  );
}
