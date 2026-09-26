/**
 * The admin's relay queue. MSG-7.
 *
 * Mediation needs a worklist rather than a search: threads with messages
 * waiting on a decision come first, and within that the longest wait, so
 * nobody is left indefinitely.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminQueue } from "@/lib/relay-lists";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relay queue · Declutter admin",
};

export default async function AdminEnquiriesPage() {
  const user = await getSessionUser();

  if (!user) redirect("/signin?next=/admin/enquiries");
  // Role is checked here as well as on every route the page calls, because
  // hiding a link is not access control (AUTH-6).
  if (user.role !== "admin") redirect("/");

  const threads = await getAdminQueue();
  const waiting = threads.filter((thread) => thread.waiting > 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-12">
      <Link href="/admin" className="text-sm text-[#1E5F4B] hover:underline">
        Back to the admin desk
      </Link>

      <header className="mt-4 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Relay queue
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
          {waiting.length === 0
            ? "Nothing is waiting on a decision."
            : `${waiting.length} conversation${waiting.length === 1 ? "" : "s"} waiting on you. Nothing reaches the other party until you relay it.`}
        </p>
      </header>

      {threads.length === 0 ? (
        <p className="mt-6 rounded border border-dashed border-[#B4B4B4] p-8 text-center text-[13px] text-[#6B6B6B]">
          No enquiries yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/threads/${thread.id}`}
                className="flex flex-col gap-2 rounded border border-[#B4B4B4] p-4 hover:border-[#6B6B6B] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[#1F1F1F]">
                    {thread.itemTitle}
                  </span>
                  {/* Both parties named: the admin's visibility is total. */}
                  <span className="text-[13px] text-[#6B6B6B]">
                    {thread.buyerName} asking {thread.sellerName}
                  </span>
                </span>

                {thread.waiting > 0 ? (
                  <span className="flex-none rounded-[3px] border border-[#D9C9A3] bg-[#FDF6E8] px-2.5 py-1 text-[12px] font-medium text-[#6B5324]">
                    {thread.waiting} waiting
                  </span>
                ) : (
                  <span className="flex-none text-[12px] text-[#6B6B6B]">Handled</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
