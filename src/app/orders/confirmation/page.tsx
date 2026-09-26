/**
 * Order confirmation. BUY-7.
 *
 * Rendered on the server from real order rows. The order ids arrive in the
 * URL, which anyone can edit, so they are only a lookup key: the read is
 * scoped to the acting buyer and an id that is not theirs shows nothing.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getActingBuyer } from "@/lib/acting-buyer";
import { getBuyerOrders } from "@/lib/checkout";
import { formatNaira, toMoney } from "@/lib/pricing";
import { REFUND_TERMS } from "@/lib/refund-policy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deposit received · Declutter",
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** Same bounds as a cart: at most 50 ids, each id-shaped. */
function parseIds(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 64)
    .slice(0, 50);
}

const HOLD_DATE = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const ids = parseIds((await searchParams).ids);
  const buyer = await getActingBuyer();
  const orders = await getBuyerOrders(buyer.id, ids);

  if (orders.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mt-8 rounded border border-dashed border-[#DDDEE9] p-10 text-center">
          <h1 className="text-sm font-medium text-[#12142B]">No order to show</h1>
          <p className="mt-1.5 text-[13px] text-[#6B6E84]">
            This link does not match an order on your account.
          </p>
          <Link href="/" className="mt-4 inline-block text-[13px] text-[#2A2D64] underline">
            Browse the marketplace
          </Link>
        </div>
      </main>
    );
  }

  const depositTotal = orders.reduce((sum, o) => sum.plus(o.depositAmount), toMoney(0));
  const balanceTotal = orders.reduce((sum, o) => sum.plus(o.balanceAmount), toMoney(0));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#2A2D64]"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m5 12 5 5L19 7" />
            </svg>
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#12142B] sm:text-[26px]">
            Deposit received
          </h1>
        </div>
        <p className="text-sm text-[#12142B]">
          {orders.length === 1
            ? "Your item is on hold for you and has left the marketplace."
            : `Your ${orders.length} items are on hold for you and have left the marketplace.`}
        </p>
        <p className="rounded border border-[#E8A33D] bg-[#FCF3E3] p-2.5 text-xs leading-relaxed text-[#6B4A12]">
          Simulated payment: no money moved. The orders below are real records.
        </p>
      </header>

      <ul className="mt-6 flex flex-col gap-4">
        {orders.map((order) => (
          <li
            key={order.id}
            className="flex flex-col gap-4 rounded-lg border border-[#DDDEE9] bg-white p-4 sm:flex-row"
          >
            <div className="relative h-[100px] w-full flex-none overflow-hidden rounded-[3px] bg-[#EDEEF6] sm:w-[120px]">
              {order.thumbnail && (
                <Image
                  src={order.thumbnail}
                  alt={order.title}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <span className="font-mono text-[11px] text-[#6B6E84]">
                Order <span className="text-[#12142B]">{order.reference}</span>
              </span>
              <span className="text-base font-semibold text-[#12142B]">{order.title}</span>

              <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
                <dt className="text-[13px] text-[#6B6E84]">Price</dt>
                <dd className="text-right font-mono text-[13px] text-[#6B6E84]">
                  {formatNaira(order.listedPrice)}
                </dd>
                <dt className="text-[13px] font-medium text-[#12142B]">Deposit paid</dt>
                <dd className="text-right text-[13px] font-semibold text-[#12142B]">
                  {formatNaira(order.depositAmount)}
                </dd>
                <dt className="text-[13px] text-[#6B6E84]">Balance outstanding</dt>
                <dd className="text-right font-mono text-[13px] text-[#6B6E84]">
                  {formatNaira(order.balanceAmount)}
                </dd>
                <dt className="text-[13px] text-[#6B6E84]">Held until</dt>
                <dd className="text-right font-mono text-[13px] text-[#6B6E84]">
                  <time dateTime={order.holdExpiresAt}>
                    {HOLD_DATE.format(new Date(order.holdExpiresAt))}
                  </time>
                </dd>
              </dl>
            </div>
          </li>
        ))}
      </ul>

      {orders.length > 1 && (
        <div className="mt-4 flex flex-col gap-1.5 rounded border border-[#2A2D64] bg-[#EDEEF6] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-[#12142B]">Total deposit paid</span>
            <span className="text-base font-semibold text-[#12142B]">
              {formatNaira(depositTotal)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[#6B6E84]">Total balance outstanding</span>
            <span className="font-mono text-[13px] text-[#6B6E84]">
              {formatNaira(balanceTotal)}
            </span>
          </div>
        </div>
      )}

      <section aria-labelledby="terms-heading" className="mt-8 flex flex-col gap-2.5">
        <h2 id="terms-heading" className="text-[15px] font-semibold text-[#12142B]">
          The terms you accepted
        </h2>
        <ul className="flex flex-col gap-1.5">
          {REFUND_TERMS.map((term) => (
            <li key={term.event} className="text-[13px] leading-relaxed text-[#6B6E84]">
              {term.event}: {term.outcome.toLowerCase()}.
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-col gap-3 rounded-lg border border-[#2A2D64] bg-[#EDEEF6] p-5">
        <h2 className="text-[15px] font-semibold text-[#12142B]">Keep track of this</h2>
        <p className="text-[13px] leading-relaxed text-[#6B6E84]">
          Your orders are always here, with what you paid, what is left to pay and how long
          each item is held.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex h-11 items-center justify-center rounded-lg bg-[#E8A33D] px-5 text-[13px] font-semibold text-[#12142B]"
            >
              {orders.length === 1 ? "Open your order" : order.reference}
            </Link>
          ))}
          <Link
            href="/orders"
            className="flex h-11 items-center justify-center rounded-lg border border-[#DDDEE9] bg-white px-5 text-[13px] text-[#12142B]"
          >
            All your orders
          </Link>
        </div>
      </div>

      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center text-sm text-[#2A2D64] hover:underline"
      >
        Back to the marketplace
      </Link>
    </main>
  );
}
