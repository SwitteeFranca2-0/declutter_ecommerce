"use client";

/**
 * One conversation, with polling.
 *
 * ── ASSESSED AJAX ─────────────────────────────────────────────────────────
 * This is the third assessed asynchronous interaction (MSG-8), after the
 * category filter and the cart badge. Every few seconds the page calls
 * `GET /api/threads/<id>?after=<newest message id>` with `fetch` and appends
 * whatever comes back, so a reply appears without a page reload. Sending a
 * message is a second explicit `fetch`, to `POST /api/threads`.
 *
 * The interval is deliberately visible here rather than hidden behind a
 * data-fetching library, because the course examines the DOM, AJAX and JSON
 * exchange directly.
 *
 * Polling pauses when the tab is hidden and resumes on return, so an open tab
 * does not poll all night.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Masking is not this component's job. The server has already dropped every
 * identity the viewer must not have, so there is nothing here to hide.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

const POLL_INTERVAL_MS = 5000;

type Message = {
  id: string;
  body: string;
  from: string;
  mine: boolean;
  visibleTo?: string;
  createdAt: string;
};

type Thread = {
  id: string;
  itemId: string;
  itemTitle: string;
  status: string;
  messages: Message[];
};

const MODERATION_LABELS: Record<string, string> = {
  buyer_and_admin: "Waiting on you: the seller cannot see this yet",
  seller_and_admin: "Waiting on you: the buyer cannot see this yet",
  both: "Relayed to both",
  admin_only: "Withheld. Visible to you and its sender only",
};

export function ThreadView({
  initial,
  isAdmin,
  canReply,
}: {
  initial: Thread;
  isAdmin: boolean;
  canReply: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newest = useRef<string | null>(initial.messages.at(-1)?.id ?? null);

  const merge = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const known = new Set(current.map((message) => message.id));
      const added = incoming.filter((message) => !known.has(message.id));
      if (added.length === 0) return current;
      newest.current = added.at(-1)?.id ?? newest.current;
      return [...current, ...added];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      // Nothing to ask for while the tab is in the background.
      if (document.hidden) return;

      try {
        const query = newest.current ? `?after=${encodeURIComponent(newest.current)}` : "";
        const response = await fetch(`/api/threads/${initial.id}${query}`);
        if (!response.ok || cancelled) return;

        const thread = (await response.json()) as Thread;
        merge(thread.messages);
      } catch {
        // A failed poll is not worth interrupting a conversation over: the
        // next tick tries again.
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [initial.id, merge]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: initial.id, body: draft }),
      });

      if (response.status === 201) {
        const { thread } = (await response.json()) as { thread: Thread };
        setMessages(thread.messages);
        newest.current = thread.messages.at(-1)?.id ?? newest.current;
        setDraft("");
      } else {
        const failure = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(failure?.error ?? "Your message was not sent.");
      }
    } catch {
      setError("Could not reach Declutter. Your message was not sent.");
    }

    setSending(false);
  }

  async function moderate(messageId: string, action: "relay" | "withhold") {
    setError(null);

    try {
      const response = await fetch(`/api/admin/messages/${messageId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        setError("That decision did not go through.");
        return;
      }

      const { visibleTo } = (await response.json()) as { visibleTo: string };
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, visibleTo } : message,
        ),
      );
    } catch {
      setError("Could not reach Declutter.");
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <ul aria-live="polite" className="flex flex-col gap-3">
        {messages.length === 0 && (
          <li className="rounded border border-dashed border-[#B4B4B4] p-6 text-center text-[13px] text-[#6B6B6B]">
            Nothing here yet.
          </li>
        )}

        {messages.map((message) => (
          <li
            key={message.id}
            className={`flex flex-col gap-1.5 rounded border p-3.5 ${
              message.mine
                ? "border-[#1E5F4B] bg-[#F4F8F6] sm:ml-10"
                : "border-[#B4B4B4] sm:mr-10"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#6B6B6B]">
                {message.from}
              </span>
              <time
                dateTime={message.createdAt}
                className="font-mono text-[11px] text-[#6B6B6B]"
              >
                {new Date(message.createdAt).toLocaleString("en-NG", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>

            {/* User-supplied. React escapes it; never dangerouslySetInnerHTML. */}
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#1F1F1F]">
              {message.body}
            </p>

            {isAdmin && message.visibleTo && (
              <div className="mt-1 flex flex-col gap-2 border-t border-[#E8E8E8] pt-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] text-[#6B6B6B]">
                  {MODERATION_LABELS[message.visibleTo] ?? message.visibleTo}
                </span>
                {message.visibleTo !== "both" && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void moderate(message.id, "relay")}
                      className="min-h-11 rounded bg-[#1E5F4B] px-3 text-[12px] font-semibold text-white"
                    >
                      Relay
                    </button>
                    {message.visibleTo !== "admin_only" && (
                      <button
                        type="button"
                        onClick={() => void moderate(message.id, "withhold")}
                        className="min-h-11 rounded border border-[#B4B4B4] px-3 text-[12px] text-[#1F1F1F]"
                      >
                        Withhold
                      </button>
                    )}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="rounded border border-[#D9C9A3] bg-[#FDF6E8] p-2.5 text-[13px] text-[#6B5324]">
          {error}
        </p>
      )}

      {canReply && (
        <form onSubmit={send} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#1F1F1F]">Your message</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="rounded border border-[#B4B4B4] p-3 text-sm leading-relaxed text-[#1F1F1F]"
            />
          </label>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="flex h-12 items-center justify-center rounded bg-[#1E5F4B] text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit sm:px-8"
          >
            {sending ? "Sending…" : "Send through Declutter"}
          </button>
          <p className="text-xs leading-relaxed text-[#6B6B6B]">
            Messages pass through Declutter before they reach the other party, so a reply is
            not instant. Contact details are not relayed.
          </p>
        </form>
      )}
    </div>
  );
}
