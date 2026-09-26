/**
 * A list of conversations, shared by the buyer's and the seller's pages.
 *
 * It renders only what its caller passes, and the callers are the scoped
 * queries in `relay-lists.ts`. Nothing here decides who may see what.
 */

import Link from "next/link";

import type { ThreadSummary } from "@/lib/relay-lists";

export function ThreadList({
  threads,
  emptyMessage,
  emptyAction,
}: {
  threads: ThreadSummary[];
  emptyMessage: string;
  emptyAction?: { href: string; label: string };
}) {
  if (threads.length === 0) {
    return (
      <div className="mt-6 rounded border border-dashed border-[#B4B4B4] p-8 text-center">
        <p className="text-[13px] text-[#6B6B6B]">{emptyMessage}</p>
        {emptyAction && (
          <Link
            href={emptyAction.href}
            className="mt-3 inline-block text-[13px] text-[#1E5F4B] underline"
          >
            {emptyAction.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {threads.map((thread) => (
        <li key={thread.id}>
          <Link
            href={`/threads/${thread.id}`}
            className="flex items-start gap-3.5 rounded border border-[#B4B4B4] p-3.5 hover:border-[#6B6B6B]"
          >
            <div className="h-[56px] w-[56px] flex-none overflow-hidden rounded-[3px] bg-[#E8E8E8]">
              {thread.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thread.thumbnail}
                  alt={thread.itemTitle}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-[#1F1F1F]">
                  {thread.itemTitle}
                </span>
                {thread.awaitingYou && (
                  <span className="flex-none rounded-[3px] border border-[#D9C9A3] bg-[#FDF6E8] px-2 py-0.5 text-[11px] font-medium text-[#6B5324]">
                    Needs a reply
                  </span>
                )}
              </div>

              <span className="line-clamp-2 text-[13px] text-[#6B6B6B]">
                {thread.lastMessage ?? "Waiting for Declutter to pass this on."}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
