/**
 * One order.
 *
 * What was paid, what is still owed, how long the item is held, and what
 * happens next. Scoped to the acting buyer, so an order id in a URL that is
 * not theirs is indistinguishable from one that does not exist.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getActingBuyer } from "@/lib/acting-buyer";
import { getOrderForBuyer } from "@/lib/orders";
import { formatNaira } from "@/lib/pricing";
import { HOLD_DURATION_HOURS } from "@/lib/item-state";
import { REFUND_TERMS } from "@/lib/refund-policy";
import { STATUS_LABELS } from "../order-list";

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
  const buyer = await getActingBuyer();
  const order = await getOrderForBuyer(id, buyer.id);

  if (!order) notFound();

  const lapsed = order.status === "expired";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/orders" className="text-sm font-medium text-[#2A2D64] hover:underline">
        Back to your orders
      </Link>

      <header className="mt-5 flex flex-col gap-2">
        <span className="font-mono text-[11px] text-[#6B6E84]">
          Order <span className="text-[#12142B]">{order.reference}</span>
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#12142B] sm:text-[30px]">
          {order.itemTitle}
        </h1>
        <span
          className={`w-fit rounded-full px-3 py-1 text-[12px] font-medium ${
            lapsed ? "bg-[#F4F4F8] text-[#6B6E84]" : "bg-[#EDEEF6] text-[#2A2D64]"
          }`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </header>

      <section className="mt-6 flex flex-col gap-3 rounded-lg bg-[#EDEEF6] p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[13px] text-[#6B6E84]">Item price</span>
          <span className="font-mono text-[13px] text-[#6B6E84]">
            {formatNaira(order.listedPrice)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[13px] text-[#6B6E84]">Deposit paid</span>
          <span className="font-mono text-[13px] text-[#12142B]">
            {formatNaira(order.depositAmount)}
          </span>
        </div>
        <div className="h-px bg-[#DDDEE9]" />
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-semibold text-[#12142B]">Balance on collection</span>
          <span className="text-2xl font-semibold tracking-[-0.01em] text-[#12142B]">
            {formatNaira(order.balanceAmount)}
          </span>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-[#DDDEE9] bg-white p-5">
        <h2 className="text-[15px] font-semibold text-[#12142B]">
          {lapsed ? "This hold has expired" : "Held for you"}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B6E84]">
          {lapsed ? (
            <>
              The {HOLD_DURATION_HOURS}-hour hold ran out, so the item went back on the
              marketplace for other buyers.
            </>
          ) : (
            <>
              Nobody else can reserve this item until{" "}
              <time dateTime={order.holdExpiresAt} className="font-mono text-[#12142B]">
                {WHEN.format(new Date(order.holdExpiresAt))}
              </time>
              .
            </>
          )}
        </p>
        {!lapsed && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B6E84]">
            Arranging the handover and paying the balance arrive in a later stage of this
            project. Your deposit is recorded and the item is off the marketplace.
          </p>
        )}
      </section>

      <section aria-labelledby="terms" className="mt-8">
        <h2 id="terms" className="text-[15px] font-semibold text-[#12142B]">
          The terms you accepted
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {REFUND_TERMS.map((term) => (
            <li key={term.event} className="text-[13px] leading-relaxed text-[#6B6E84]">
              {term.event}: {term.outcome.toLowerCase()}.
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-[#2A2D64] hover:underline"
      >
        Back to the marketplace
      </Link>
    </main>
  );
}
