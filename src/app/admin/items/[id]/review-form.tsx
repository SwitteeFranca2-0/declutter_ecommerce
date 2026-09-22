"use client";

/**
 * The decision. ADMIN-2, ADMIN-3, ADMIN-4.
 *
 * Posts JSON to `POST /api/admin/items/[id]/review` with `fetch`, so a refused
 * price does not cost the admin the copy they just edited. Field messages come
 * from the route's own validation: the margin rule is stated here in prose but
 * enforced only on the server, against the payout stored on the row.
 *
 * The margin is computed as the admin types purely so they can see what they
 * are setting. Nothing about it is sent, and nothing depends on it.
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type FieldError = { field: string; message: string };

export function ReviewForm({
  itemId,
  title: submittedTitle,
  description: submittedDescription,
  requestedPayout,
}: {
  itemId: string;
  title: string;
  description: string;
  requestedPayout: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(submittedTitle);
  const [description, setDescription] = useState(submittedDescription);
  const [listedPrice, setListedPrice] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  const payout = Number(requestedPayout);
  const price = Number(listedPrice);
  // Only meaningful once the price is a number above the payout; below that the
  // form says why rather than showing a negative margin as if it were a figure.
  const margin = Number.isFinite(price) && listedPrice !== "" ? price - payout : null;

  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message;

  async function decide(decision: "approve" | "reject", event: FormEvent) {
    event.preventDefault();
    setSubmitting(decision);
    setErrors([]);
    setFormError(null);

    const payload =
      decision === "approve"
        ? { decision, title, description, listedPrice }
        : { decision, reason };

    try {
      const response = await fetch(`/api/admin/items/${itemId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body: unknown = await response.json().catch(() => null);

      if (response.ok) {
        // The item has left the queue, so there is nothing here to return to.
        router.push("/admin");
        router.refresh();
        return;
      }

      const failure = body as { error?: string; details?: FieldError[] } | null;
      setErrors(failure?.details ?? []);
      setFormError(failure?.details?.length ? null : (failure?.error ?? "That did not work."));
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    }

    setSubmitting(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => void decide("approve", event)}
        className="flex flex-col gap-4 rounded border border-[#1E5F4B] bg-[#F4F8F6] p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-[#1F1F1F]">Publish this listing</h2>
          <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
            Correct the copy if it needs it, then set the public price. The seller is paid
            their requested payout whatever you list it at; the difference is the platform
            margin.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="font-mono text-[11px] text-[#6B6B6B]">
            Listing title
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="min-h-11 rounded border border-[#B4B4B4] bg-white px-3 text-sm text-[#1F1F1F]"
            aria-describedby={errorFor("title") ? "title-error" : undefined}
            aria-invalid={errorFor("title") ? true : undefined}
          />
          {errorFor("title") && (
            <p id="title-error" className="text-[13px] text-[#8A6D2F]">
              {errorFor("title")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="font-mono text-[11px] text-[#6B6B6B]">
            Listing description
          </label>
          <textarea
            id="description"
            name="description"
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded border border-[#B4B4B4] bg-white p-3 text-[13px] leading-relaxed text-[#1F1F1F]"
            aria-describedby={errorFor("description") ? "description-error" : undefined}
            aria-invalid={errorFor("description") ? true : undefined}
          />
          {errorFor("description") && (
            <p id="description-error" className="text-[13px] text-[#8A6D2F]">
              {errorFor("description")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="listedPrice" className="font-mono text-[11px] text-[#6B6B6B]">
            Public price, ₦
          </label>
          <input
            id="listedPrice"
            name="listedPrice"
            inputMode="decimal"
            value={listedPrice}
            onChange={(event) => setListedPrice(event.target.value)}
            className="min-h-11 rounded border border-[#B4B4B4] bg-white px-3 text-sm text-[#1F1F1F]"
            aria-describedby="price-help"
            aria-invalid={errorFor("listedPrice") ? true : undefined}
          />

          <p id="price-help" className="font-mono text-[11px] text-[#6B6B6B]">
            Seller is paid ₦{payout.toLocaleString("en-NG")}
            {margin !== null && margin > 0 && (
              <span className="text-[#1E5F4B]">
                {" "}
                · margin ₦{margin.toLocaleString("en-NG")}
              </span>
            )}
            {margin !== null && margin <= 0 && (
              <span className="text-[#8A6D2F]"> · must be above the payout</span>
            )}
          </p>

          {errorFor("listedPrice") && (
            <p className="text-[13px] text-[#8A6D2F]">{errorFor("listedPrice")}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting !== null}
          className="min-h-11 rounded bg-[#1E5F4B] px-5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {submitting === "approve" ? "Publishing…" : "Approve and publish"}
        </button>
      </form>

      <form
        onSubmit={(event) => void decide("reject", event)}
        className="flex flex-col gap-4 rounded border border-[#B4B4B4] p-4"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-[#1F1F1F]">Reject this submission</h2>
          <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
            The seller sees the reason on their submissions page. A rejection is final: they
            submit again rather than appealing.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="font-mono text-[11px] text-[#6B6B6B]">
            Reason for the seller
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded border border-[#B4B4B4] bg-white p-3 text-[13px] leading-relaxed text-[#1F1F1F]"
            aria-describedby={errorFor("reason") ? "reason-error" : undefined}
            aria-invalid={errorFor("reason") ? true : undefined}
          />
          {errorFor("reason") && (
            <p id="reason-error" className="text-[13px] text-[#8A6D2F]">
              {errorFor("reason")}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting !== null}
          className="min-h-11 rounded border border-[#B4B4B4] px-5 text-[13px] font-semibold text-[#1F1F1F] disabled:opacity-60"
        >
          {submitting === "reject" ? "Rejecting…" : "Reject with this reason"}
        </button>
      </form>

      {/* Anything the fields cannot carry: a 409 from a stale queue, a
          network failure. Announced, because neither is visible otherwise. */}
      {formError && (
        <p
          role="alert"
          className="rounded border border-[#D9C9A3] bg-[#FDF6E8] p-3 text-[13px] text-[#8A6D2F]"
        >
          {formError}
        </p>
      )}
    </div>
  );
}
