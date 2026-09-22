/**
 * Reviewing one submission. ADMIN-1, ADMIN-3, ADMIN-4.
 *
 * The read is scoped to `pending_review`, so an item that has already been
 * decided is a 404 here rather than a second chance to decide it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSubmissionForReview } from "@/lib/review";
import { getSessionUser } from "@/lib/session";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review submission · Declutter",
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

export default async function ReviewSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  const { id } = await params;

  if (!user) redirect(`/signin?next=/admin/items/${id}`);
  if (user.role !== "admin") redirect("/");

  const submission = await getSubmissionForReview(id);

  if (!submission) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-12">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-[13px] text-[#1E5F4B] underline"
      >
        Back to the queue
      </Link>

      <header className="mt-2 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Review submission
        </h1>
        <p className="font-mono text-[11px] text-[#6B6B6B]">
          {CATEGORY_LABELS[submission.category] ?? submission.category} ·{" "}
          {CONDITION_LABELS[submission.condition] ?? submission.condition} · offered by{" "}
          {submission.sellerName}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* What the seller sent, unedited, so the decision is made against it. */}
        <section aria-labelledby="as-submitted" className="flex-1">
          <h2 id="as-submitted" className="text-[15px] font-semibold text-[#1F1F1F]">
            As submitted
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {submission.images.length === 0 ? (
              <p className="col-span-full rounded border border-dashed border-[#B4B4B4] p-6 text-center text-[13px] text-[#6B6B6B]">
                No photographs were uploaded.
              </p>
            ) : (
              submission.images.map((url, index) => (
                <div
                  key={url}
                  className="aspect-square overflow-hidden rounded-[3px] border border-[#B4B4B4] bg-[#E8E8E8]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${submission.title}, photograph ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))
            )}
          </div>

          <dl className="mt-4 flex flex-col gap-3 rounded border border-[#B4B4B4] p-4">
            <div className="flex flex-col gap-0.5">
              <dt className="font-mono text-[11px] text-[#6B6B6B]">Title</dt>
              {/* Seller-supplied. React escapes it. */}
              <dd className="text-sm text-[#1F1F1F]">{submission.title}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-mono text-[11px] text-[#6B6B6B]">Description</dt>
              <dd className="whitespace-pre-line text-[13px] leading-relaxed text-[#1F1F1F]">
                {submission.description}
              </dd>
            </div>
          </dl>
        </section>

        <div className="w-full flex-none lg:w-[380px]">
          <ReviewForm
            itemId={submission.id}
            title={submission.title}
            description={submission.description}
            requestedPayout={submission.requestedPayout}
          />
        </div>
      </div>
    </main>
  );
}
