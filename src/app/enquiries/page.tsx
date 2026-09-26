/**
 * A buyer's own enquiries. BUY-4.
 *
 * Scoped to the signed-in buyer, so a conversation started yesterday is
 * findable without a link and nobody else's is reachable at all.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getBuyerThreads } from "@/lib/relay-lists";
import { getSessionUser } from "@/lib/session";
import { ThreadList } from "@/app/threads/thread-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your enquiries · Declutter",
};

export default async function EnquiriesPage() {
  const user = await getSessionUser();

  if (!user) redirect("/signin?next=/enquiries");

  const threads = await getBuyerThreads(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Your enquiries
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
          Questions you have asked about items. Sellers answer through Declutter and never
          learn who you are.
        </p>
      </header>

      <ThreadList
        threads={threads}
        emptyMessage="You have not asked about anything yet."
        emptyAction={{ href: "/", label: "Browse the marketplace" }}
      />
    </main>
  );
}
