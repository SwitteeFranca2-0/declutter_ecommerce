/**
 * The admin review queue. ADMIN-1.
 *
 * Longest wait first, because a seller who submitted last week should not sit
 * behind one who submitted this morning. Each row carries enough to choose
 * what to open next without opening everything.
 *
 * The guard is here as well as on the route handler. A page that rendered the
 * queue and left the write protected would leak every pending submission to
 * anyone who typed the URL (AUTH-6).
 */

import type { Metadata } from "next";
import Link from "next/link";

import { getReviewQueue } from "@/lib/review";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review queue · Declutter",
};

const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electronics",
  furniture: "Furniture",
  appliances: "Appliances",
  fashion: "Fashion",
  books: "Books",
  other: "Other",
};

const CONDITION_LABELS: Record<string, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

/** How long a submission has waited, in the coarsest honest unit. */
function waitedFor(submittedAt: string, now: Date): string {
  const hours = Math.floor((now.getTime() - new Date(submittedAt).getTime()) / 3_600_000);

  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export default async function AdminQueuePage() {
  const user = await getSessionUser();

  if (!user) redirect("/signin?next=/admin");
  if (user.role !== "admin") redirect("/");

  const queue = await getReviewQueue();
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Review queue
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
          {queue.length === 0
            ? "Nothing is waiting for a decision."
            : `${queue.length} submission${queue.length === 1 ? "" : "s"} awaiting a decision, longest wait first.`}
        </p>
      </header>

      {queue.length === 0 ? (
        <p className="mt-6 rounded border border-dashed border-[#B4B4B4] p-8 text-center text-[13px] text-[#6B6B6B]">
          The queue is empty. Submissions appear here as sellers offer them.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {queue.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/items/${row.id}`}
                className="flex min-h-11 flex-col gap-3 rounded border border-[#B4B4B4] p-3.5 hover:border-[#1E5F4B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E5F4B] sm:flex-row sm:items-center"
              >
                <div className="h-[70px] w-full flex-none overflow-hidden rounded-[3px] bg-[#E8E8E8] sm:w-[90px]">
                  {row.thumbnail && (
                    // Not next/image: an uploaded file has no known dimensions.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnail}
                      alt={row.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  {/* Seller-supplied. React escapes it. */}
                  <span className="text-[15px] font-semibold text-[#1F1F1F]">{row.title}</span>
                  <span className="font-mono text-[11px] text-[#6B6B6B]">
                    {CATEGORY_LABELS[row.category] ?? row.category} ·{" "}
                    {CONDITION_LABELS[row.condition] ?? row.condition} · {row.sellerName} ·{" "}
                    {waitedFor(row.submittedAt, now)}
                  </span>
                </div>

                <div className="flex flex-none flex-col items-start gap-0.5 sm:items-end">
                  <span className="font-mono text-[11px] text-[#6B6B6B]">Requested payout</span>
                  <span className="text-sm font-semibold text-[#1F1F1F]">
                    ₦{Number(row.requestedPayout).toLocaleString("en-NG")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
