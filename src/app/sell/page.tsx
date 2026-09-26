/**
 * Offer an item. SELL-1.
 *
 * The shell resolves the seller and handles the three ways in that are not a
 * form: signed out, signed in as a buyer, or a seller whose phone is not yet
 * verified. The route refuses each of those anyway; this explains them.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSellerSubmissions } from "@/lib/listings";
import { getSellerThreads } from "@/lib/relay-lists";
import { ThreadList } from "@/app/threads/thread-list";
import { getSessionUser } from "@/lib/session";
import { SubmissionForm } from "./submission-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sell an item · Declutter",
};

export default async function SellPage() {
  const user = await getSessionUser();

  if (!user) redirect("/signin?next=/sell");

  if (user.role !== "seller") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F]">
          Selling needs a seller account
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B6B6B]">
          You are signed in as a buyer. Declutter keeps the two apart so it is always clear
          which side of a sale an account is on.
        </p>
        <Link href="/" className="mt-4 inline-block text-[13px] text-[#1E5F4B] underline">
          Back to the marketplace
        </Link>
      </main>
    );
  }

  const submissions = user.phoneVerified ? await getSellerSubmissions(user.id) : [];
  const threads = user.phoneVerified ? await getSellerThreads(user.id) : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Offer an item
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
          Tell us what you have and what you want to be paid. Declutter reviews every
          submission before it reaches the marketplace.
        </p>
      </header>

      {!user.phoneVerified ? (
        <div className="mt-6 rounded border border-[#D9C9A3] bg-[#FDF6E8] p-4">
          <p className="text-sm font-semibold text-[#6B5324]">Verify your phone first</p>
          <p className="mt-1 text-[13px] text-[#6B5324]">
            A listing needs a reachable seller behind it, so verification comes before your
            first submission. Any code is accepted in this prototype.
          </p>
          <Link
            href="/verify-phone"
            className="mt-3 inline-flex h-11 items-center rounded bg-[#1E5F4B] px-5 text-[13px] font-semibold text-white"
          >
            Verify {user.phone}
          </Link>
        </div>
      ) : (
        <>
          {/* What the seller is agreeing to, before they fill anything in. */}
          <div className="mt-6 flex flex-col gap-2 rounded border border-[#1E5F4B] bg-[#F4F8F6] p-4">
            <h2 className="text-sm font-semibold text-[#1F1F1F]">How pricing works here</h2>
            <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
              You state the payout you want. Declutter reviews the item and sets the public
              price, which is higher than your payout: the difference is what the platform
              keeps for holding the money and mediating the handover. Your payout does not
              change with the price.
            </p>
          </div>

          <SubmissionForm />

          <section aria-labelledby="submissions-heading" className="mt-10">
            <h2 id="submissions-heading" className="text-base font-semibold text-[#1F1F1F]">
              Your submissions
            </h2>
            <SubmissionList submissions={submissions} />
          </section>

          <section aria-labelledby="reserved-heading" className="mt-10">
            <h2 id="reserved-heading" className="text-base font-semibold text-[#1F1F1F]">
              Reserved items
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">
              When a buyer pays a deposit, a conversation opens for arranging the handover.{" "}
              <Link href="/sell/orders" className="text-[#1E5F4B] underline">
                See what is reserved
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="enquiries-heading" className="mt-10">
            <h2 id="enquiries-heading" className="text-base font-semibold text-[#1F1F1F]">
              Questions about your items
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">
              Buyers ask through Declutter. You answer the question without being told who
              asked it.
            </p>
            <ThreadList
              threads={threads}
              emptyMessage="No questions yet."
            />
          </section>
        </>
      )}
    </main>
  );
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending_review: { label: "Awaiting review", tone: "border-[#D9C9A3] bg-[#FDF6E8] text-[#6B5324]" },
  rejected: { label: "Not accepted", tone: "border-[#B4B4B4] bg-[#F7F7F7] text-[#6B6B6B]" },
  listed: { label: "On the marketplace", tone: "border-[#1E5F4B] bg-[#F4F8F6] text-[#1E5F4B]" },
  on_hold: { label: "Reserved by a buyer", tone: "border-[#1E5F4B] bg-[#F4F8F6] text-[#1E5F4B]" },
  sold: { label: "Sold, awaiting handover", tone: "border-[#1E5F4B] bg-[#F4F8F6] text-[#1E5F4B]" },
  completed: { label: "Handed over", tone: "border-[#B4B4B4] bg-[#F7F7F7] text-[#6B6B6B]" },
};

function SubmissionList({
  submissions,
}: {
  submissions: Awaited<ReturnType<typeof getSellerSubmissions>>;
}) {
  if (submissions.length === 0) {
    return (
      <p className="mt-3 rounded border border-dashed border-[#B4B4B4] p-6 text-center text-[13px] text-[#6B6B6B]">
        Nothing submitted yet. The form above is where to start.
      </p>
    );
  }

  return (
    <ul className="mt-3 flex flex-col gap-3">
      {submissions.map((submission) => {
        const status = STATUS_LABELS[submission.status] ?? {
          label: submission.status,
          tone: "border-[#B4B4B4] text-[#6B6B6B]",
        };

        return (
          <li
            key={submission.id}
            className="flex flex-col gap-3 rounded border border-[#B4B4B4] p-3.5 sm:flex-row sm:items-start"
          >
            <div className="h-[70px] w-full flex-none overflow-hidden rounded-[3px] bg-[#E8E8E8] sm:w-[90px]">
              {submission.thumbnail && (
                // Not next/image: an uploaded file has no known dimensions and
                // this list is never more than a handful of rows.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={submission.thumbnail}
                  alt={submission.title}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              {/* Seller-supplied. React escapes it. */}
              <span className="text-sm font-semibold text-[#1F1F1F]">{submission.title}</span>
              <span
                className={`inline-flex w-fit rounded-[3px] border px-2 py-0.5 text-[11px] font-medium ${status.tone}`}
              >
                {status.label}
              </span>
              {submission.rejectionReason && (
                <span className="text-[13px] text-[#6B6B6B]">
                  Reason: {submission.rejectionReason}
                </span>
              )}
            </div>

            <div className="flex flex-none flex-col items-start gap-0.5 sm:items-end">
              <span className="font-mono text-[11px] text-[#6B6B6B]">Your payout</span>
              <span className="text-sm font-semibold text-[#1F1F1F]">
                ₦{Number(submission.requestedPayout).toLocaleString("en-NG")}
              </span>
              {submission.listedPrice && (
                <span className="font-mono text-[11px] text-[#6B6B6B]">
                  Listed at ₦{Number(submission.listedPrice).toLocaleString("en-NG")}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
