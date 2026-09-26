"use client";

/**
 * Agreeing where to meet, on the order page. LOC-1, LOC-2, LOC-3.
 *
 * The panel is an explicit `fetch` against `POST /api/orders/<id>/meetup`,
 * like every other state change in this project. Both actions also append a
 * message to the direct conversation, written by the server, so the thread
 * reads as one narrative of the handover.
 *
 * LOC-3 is copy, not validation: the advice sits beside the map where it is
 * read rather than scrolled past, and a point is never refused for being in
 * the wrong sort of place. The platform cannot know where somebody lives and
 * should not pretend to.
 */

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MeetupPoint } from "./meetup-map";

// Leaflet touches `window` at module scope, so the map never renders on the
// server, and this keeps it out of every other page's bundle.
const MeetupMap = dynamic(() => import("./meetup-map").then((m) => m.MeetupMap), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] w-full rounded border border-[#B4B4B4] bg-[#E8E8E8]" />
  ),
});

export type Meetup = {
  lat: number;
  lng: number;
  label: string;
  agreed: boolean;
  proposedById: string | null;
};

export function MeetupPanel({
  orderId,
  initial,
  viewerId,
  canAgree,
}: {
  orderId: string;
  initial: Meetup | null;
  viewerId: string;
  canAgree: boolean;
}) {
  const router = useRouter();
  const [meetup, setMeetup] = useState<Meetup | null>(initial);
  const [picked, setPicked] = useState<MeetupPoint | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const mine = meetup?.proposedById === viewerId;
  const point = picked ?? (meetup ? { lat: meetup.lat, lng: meetup.lng } : null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/meetup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json().catch(() => null)) as
        | { meetup?: Meetup; error?: string }
        | null;

      if (response.ok && payload?.meetup) {
        setMeetup(payload.meetup);
        setPicked(null);
        setLabel("");
        setProposing(false);
        // Brings the server-written message into the conversation above.
        router.refresh();
      } else {
        setError(payload?.error ?? "That did not go through.");
      }
    } catch {
      setError("Could not reach Declutter. Please try again.");
    }

    setBusy(false);
  }

  return (
    <section aria-labelledby="meetup-heading" className="mt-8">
      <h2 id="meetup-heading" className="text-base font-semibold text-[#1F1F1F]">
        Where to meet
      </h2>

      {/* LOC-3: guidance, at the moment the choice is being made. */}
      <p className="mt-1 text-[13px] leading-relaxed text-[#6B6B6B]">
        Choose somewhere public and busy: a mall entrance, a bank forecourt, a filling station.
        Avoid home addresses, and avoid quiet places after dark.
      </p>

      <div className="mt-3">
        <MeetupMap value={point} onPick={setPicked} interactive={canAgree && proposing} />
      </div>

      <p className="mt-1.5 text-[11px] text-[#6B6B6B]">
        Map data from OpenStreetMap contributors. No account or key is needed.
      </p>

      {meetup && !proposing && (
        <div
          className={`mt-3 rounded border p-4 ${
            meetup.agreed ? "border-[#1E5F4B] bg-[#F4F8F6]" : "border-[#D9C9A3] bg-[#FDF6E8]"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              meetup.agreed ? "text-[#1E5F4B]" : "text-[#6B5324]"
            }`}
          >
            {meetup.agreed
              ? "Agreed"
              : mine
                ? "Waiting for the other party to accept"
                : "Proposed, waiting on you"}
          </p>
          {/* User-supplied. React escapes it. */}
          <p className="mt-1 text-sm text-[#1F1F1F]">{meetup.label}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[#6B6B6B]">
            {meetup.lat.toFixed(5)}, {meetup.lng.toFixed(5)}
          </p>

          {canAgree && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {!meetup.agreed && !mine && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send({ action: "accept" })}
                  className="flex h-11 items-center justify-center rounded bg-[#1E5F4B] px-5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Agreeing…" : "Agree this point"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setProposing(true)}
                className="flex h-11 items-center justify-center rounded border border-[#B4B4B4] px-5 text-[13px] text-[#1F1F1F]"
              >
                {meetup.agreed ? "Propose somewhere else" : "Suggest somewhere else"}
              </button>
            </div>
          )}
        </div>
      )}

      {canAgree && !meetup && !proposing && (
        <button
          type="button"
          onClick={() => setProposing(true)}
          className="mt-3 flex h-11 items-center justify-center rounded bg-[#1E5F4B] px-5 text-[13px] font-semibold text-white"
        >
          Propose a meeting point
        </button>
      )}

      {canAgree && proposing && (
        <div className="mt-3 flex flex-col gap-3 rounded border border-[#B4B4B4] p-4">
          <p className="text-[13px] text-[#6B6B6B]">
            {picked
              ? "Name the spot so the other person knows exactly where to stand."
              : "Click the map to drop a pin."}
          </p>

          {picked && (
            <p className="font-mono text-[11px] text-[#6B6B6B]">
              {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#1F1F1F]">Name of the place</span>
            <input
              type="text"
              maxLength={120}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ikeja City Mall, main entrance"
              className="h-11 rounded border border-[#B4B4B4] px-3 text-sm text-[#1F1F1F]"
            />
          </label>

          {error && (
            <p role="alert" className="text-[13px] text-[#8A6D2F]">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy || !picked || !label.trim()}
              onClick={() =>
                picked && void send({ action: "propose", ...picked, label: label.trim() })
              }
              className="flex h-11 items-center justify-center rounded bg-[#1E5F4B] px-5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Proposing…" : "Propose this point"}
            </button>
            <button
              type="button"
              onClick={() => {
                setProposing(false);
                setPicked(null);
                setError(null);
              }}
              className="flex h-11 items-center justify-center rounded border border-[#B4B4B4] px-5 text-[13px] text-[#1F1F1F]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && !proposing && (
        <p role="alert" className="mt-2 text-[13px] text-[#8A6D2F]">
          {error}
        </p>
      )}

      {!canAgree && !meetup && (
        <p className="mt-3 text-[13px] text-[#6B6B6B]">
          Nothing has been proposed yet.
        </p>
      )}
    </section>
  );
}
