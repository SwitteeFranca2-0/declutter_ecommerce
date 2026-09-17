"use client";

/**
 * The checkout form.
 *
 * Layout follows the frontend-design rule for checkout: terms and payment on
 * the left, order summary on the right, and the terms always above the
 * payment action. On phone the summary moves below.
 *
 * Every figure shown comes from `POST /api/cart`. Paying posts the item
 * identifiers and the terms acceptance to `POST /api/checkout` with `fetch`,
 * and nothing else: no amount leaves the browser.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useCart } from "@/app/cart-provider";
import type { PlacedOrder, UnavailableItem } from "@/lib/checkout";
import { HOLD_DURATION_HOURS } from "@/lib/item-state";
import { formatNaira } from "@/lib/pricing";
import { REFUND_TERMS } from "@/lib/refund-policy";

type SubmitError = { message: string; unavailable: UnavailableItem[] };

/**
 * `canPayDeposit` comes from the server shell: signed in with a verified phone
 * number. The server refuses regardless; this keeps the button honest.
 */
export function CheckoutView({ canPayDeposit }: { canPayDeposit: boolean }) {
  const router = useRouter();
  const { summary, loading, ready, clear, revalidate } = useCart();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [placed, setPlaced] = useState(false);

  // Clearing the cart re-renders before navigation completes; without this the
  // buyer would glimpse "Your cart is empty" right after paying.
  if (placed) {
    return <p className="mt-8 text-sm text-[#6B6B6B]">Deposit recorded. Loading your confirmation…</p>;
  }

  if (!ready || (!summary && loading)) {
    return <p className="mt-8 text-sm text-[#6B6B6B]">Loading your cart…</p>;
  }

  const lines = summary?.lines ?? [];
  const available = lines.filter((line) => line.available);
  const unavailable = lines.filter((line) => !line.available);

  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded border border-dashed border-[#B4B4B4] p-10 text-center">
        <p className="text-sm font-medium text-[#1F1F1F]">Your cart is empty</p>
        <p className="mt-1.5 text-[13px] text-[#6B6B6B]">
          There is nothing to pay a deposit on yet.
        </p>
        <Link href="/" className="mt-4 inline-block text-[13px] text-[#1E5F4B] underline">
          Browse the marketplace
        </Link>
      </div>
    );
  }

  // Checkout is all or nothing on the server, so an unavailable line blocks it
  // here too rather than letting the buyer find out after pressing pay.
  const blocked = unavailable.length > 0 || available.length === 0;
  const canPay = accepted && canPayDeposit && !blocked && !submitting && !loading;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPay) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Identifiers and the acceptance only. The server prices everything.
        body: JSON.stringify({
          itemIds: available.map((line) => line.id),
          acceptedTerms: true,
        }),
      });

      const body: unknown = await response.json().catch(() => null);

      if (response.status === 201) {
        const { orders } = body as { orders: PlacedOrder[] };
        setPlaced(true);
        clear(orders.map((order) => order.itemId));
        router.push(`/orders/confirmation?ids=${orders.map((o) => o.id).join(",")}`);
        return;
      }

      const failure = (body ?? {}) as { error?: string; unavailable?: UnavailableItem[] };
      setSubmitError({
        message: failure.error ?? "Your deposit could not be taken. Nothing was charged.",
        unavailable: failure.unavailable ?? [],
      });
      // Availability changed under the buyer: show the cart as it is now.
      if (response.status === 409) revalidate();
    } catch {
      setSubmitError({
        message: "Could not reach Declutter. Nothing was charged; please try again.",
        unavailable: [],
      });
    }

    setSubmitting(false);
  }

  const titleFor = (id: string) => lines.find((line) => line.id === id)?.title ?? "An item";

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col items-start gap-8 lg:flex-row lg:gap-10"
    >
      <div className="flex w-full flex-col gap-6">
        {/* Stated plainly and first: no money moves anywhere in this project. */}
        <div
          role="note"
          className="flex items-start gap-2.5 rounded border border-[#D9C9A3] bg-[#FDF6E8] p-3.5"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border border-[#8A6D2F] text-[11px] font-semibold text-[#8A6D2F]"
          >
            !
          </span>
          <p className="text-[13px] leading-relaxed text-[#6B5324]">
            <strong className="font-semibold">Simulated payment.</strong> This is a course
            prototype. No card is requested and no money moves: pressing pay records the deposit
            exactly as a real payment confirmation would.
          </p>
        </div>

        <section aria-labelledby="terms-heading" className="flex flex-col gap-3">
          <h2 id="terms-heading" className="text-base font-semibold text-[#1F1F1F]">
            Deposit and refund terms
          </h2>
          <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
            Your deposit is 10% of each item&rsquo;s price and holds it for you for{" "}
            {HOLD_DURATION_HOURS} hours. The balance is paid before collection. If the handover
            does not go ahead:
          </p>
          <dl className="flex flex-col rounded border border-[#B4B4B4]">
            {REFUND_TERMS.map((term, index) => (
              <div
                key={term.event}
                className={`flex flex-col gap-1 p-3.5 sm:flex-row sm:gap-6 ${
                  index > 0 ? "border-t border-[#B4B4B4]" : ""
                }`}
              >
                <dt className="text-[13px] text-[#1F1F1F] sm:w-1/2">{term.event}</dt>
                <dd className="text-[13px] text-[#6B6B6B] sm:w-1/2">{term.outcome}</dd>
              </div>
            ))}
          </dl>
        </section>

        {blocked && (
          <div className="rounded border border-[#B4B4B4] bg-[#F7F7F7] p-4">
            <p className="text-sm font-medium text-[#1F1F1F]">
              {available.length === 0
                ? "Nothing in your cart can be reserved right now."
                : "Some items in your cart are no longer available."}
            </p>
            {unavailable.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {unavailable.map((line) => (
                  <li key={line.id} className="text-[13px] text-[#6B6B6B]">
                    <span className="line-through">{line.title}</span>: {line.unavailableReason}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/cart"
              className="mt-3 inline-flex min-h-11 items-center text-[13px] text-[#1E5F4B] underline"
            >
              Review your cart
            </Link>
          </div>
        )}

        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-[#1E5F4B]"
          />
          <span className="text-sm text-[#1F1F1F]">
            I have read the deposit and refund terms and accept them.
          </span>
        </label>

        {submitError && (
          <div role="alert" className="rounded border border-[#D9C9A3] bg-[#FDF6E8] p-3.5">
            <p className="text-[13px] text-[#6B5324]">{submitError.message}</p>
            {submitError.unavailable.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-1">
                {submitError.unavailable.map((item) => (
                  <li key={item.id} className="text-[13px] text-[#6B5324]">
                    {titleFor(item.id)}: {item.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canPay}
          className="flex h-12 w-full items-center justify-center rounded bg-[#1E5F4B] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {submitting
            ? "Recording deposit…"
            : `Pay ${formatNaira(summary?.depositTotal ?? "0")} deposit (simulated)`}
        </button>
      </div>

      <aside className="flex w-full flex-none flex-col gap-4 rounded border border-[#B4B4B4] p-5 lg:w-[340px]">
        <h2 className="text-base font-semibold text-[#1F1F1F]">Order summary</h2>

        <ul className="flex flex-col gap-3">
          {available.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-[#1F1F1F]">{line.title}</span>
              <span className="flex-none font-mono text-[13px] text-[#6B6B6B]">
                {formatNaira(line.listedPrice ?? "0")}
              </span>
            </li>
          ))}
        </ul>

        <div className="h-px bg-[#B4B4B4]" />

        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-[#1F1F1F]">Deposit due today</span>
            <span className="text-xl font-semibold text-[#1F1F1F]">
              {formatNaira(summary?.depositTotal ?? "0")}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[#6B6B6B]">Balance before collection</span>
            <span className="font-mono text-[13px] text-[#6B6B6B]">
              {formatNaira(summary?.balanceTotal ?? "0")}
            </span>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[#6B6B6B]">
          Each item becomes its own order with its own reference. Amounts are recalculated by the
          server when you pay.
        </p>
      </aside>
    </form>
  );
}
