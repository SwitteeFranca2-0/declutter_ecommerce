"use client";

/**
 * Ask a question about an item. BUY-4.
 *
 * An explicit `fetch` to `POST /api/threads`, which opens the buyer's
 * conversation about this item or continues the one they already have. The
 * buyer is then taken to the thread, where polling takes over.
 *
 * A signed-out visitor is sent to sign in and returned here, so the detour
 * costs them nothing.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AskQuestion({
  itemId,
  canAsk,
  signedIn,
  verified,
}: {
  itemId: string;
  canAsk: boolean;
  signedIn: boolean;
  verified: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, body: draft }),
      });

      if (response.status === 201) {
        const { thread } = (await response.json()) as { thread: { id: string } };
        router.push(`/threads/${thread.id}`);
        return;
      }

      const failure = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(failure?.error ?? "Your question was not sent.");
    } catch {
      setError("Could not reach Declutter. Your question was not sent.");
    }

    setSending(false);
  }

  if (!signedIn) {
    return (
      <p className="text-[13px] text-[#6B6B6B]">
        <Link href={`/signin?next=/items/${itemId}`} className="text-[#1E5F4B] underline">
          Sign in
        </Link>{" "}
        to ask the seller a question. They never learn who you are.
      </p>
    );
  }

  if (!verified) {
    return (
      <p className="text-[13px] text-[#6B6B6B]">
        <Link href="/verify-phone" className="text-[#1E5F4B] underline">
          Verify your phone number
        </Link>{" "}
        to ask the seller a question.
      </p>
    );
  }

  if (!canAsk) {
    return (
      <p className="text-[13px] text-[#6B6B6B]">
        Questions go through Declutter, so a seller only answers buyers.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center justify-center rounded border border-[#1E5F4B] px-4 text-[13px] font-semibold text-[#1E5F4B] hover:bg-[#F4F8F6]"
      >
        Ask a question
      </button>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1F1F1F]">Your question</span>
        <textarea
          rows={3}
          maxLength={2000}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Is the charger included?"
          className="rounded border border-[#B4B4B4] p-3 text-sm leading-relaxed text-[#1F1F1F]"
        />
      </label>

      {error && (
        <p role="alert" className="text-[13px] text-[#8A6D2F]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-11 flex-1 items-center justify-center rounded bg-[#1E5F4B] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send through Declutter"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-11 items-center justify-center rounded border border-[#B4B4B4] px-4 text-[13px] text-[#1F1F1F]"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs leading-relaxed text-[#6B6B6B]">
        Declutter reads your question before passing it on, and the seller never learns who
        asked. Contact details are not relayed.
      </p>
    </form>
  );
}
