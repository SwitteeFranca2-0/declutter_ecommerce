/**
 * One conversation. MSG-1, MSG-2, MSG-7.
 *
 * The same page serves all three roles, because the server has already decided
 * what each may see: a buyer and a seller get a masked thread, the admin gets
 * both names and the moderation controls.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getThread } from "@/lib/relay";
import { getSessionUser } from "@/lib/session";
import { ThreadView } from "./thread-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversation · Declutter",
};

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();

  if (!user) redirect(`/signin?next=/threads/${id}`);

  const result = await getThread(id, user);

  // A thread that is not this person's is indistinguishable from one that does
  // not exist, so a thread id in a URL discovers nothing.
  if (!result.ok) notFound();

  const { thread } = result;
  const isAdmin = user.role === "admin";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={isAdmin ? "/admin/enquiries" : user.role === "seller" ? "/sell" : "/enquiries"}
        className="text-sm text-[#1E5F4B] hover:underline"
      >
        Back to your conversations
      </Link>

      <header className="mt-4 flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#6B6B6B]">
          {isAdmin ? "Relayed enquiry" : "Enquiry through Declutter"}
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F]">
          {thread.itemTitle}
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
          {isAdmin
            ? "You see both parties in full. Nothing reaches the other side until you relay it."
            : user.role === "seller"
              ? "You are answering a buyer. Declutter does not pass on who they are."
              : "The seller never learns who you are. Declutter passes your questions on."}
        </p>
      </header>

      <ThreadView initial={thread} isAdmin={isAdmin} canReply={thread.status === "open"} />
    </main>
  );
}
