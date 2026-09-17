"use client";

/**
 * The verification form.
 *
 * Two actions against `POST /api/verify-phone`: submit a code, which the
 * server accepts whatever it is, or correct the number first. The route only
 * ever verifies the caller, so neither action can touch another account.
 */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function VerifyPhoneForm({ phone }: { phone: string }) {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [editing, setEditing] = useState(false);
  const [newPhone, setNewPhone] = useState(phone);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function send(body: Record<string, string>) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/verify-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setEditing(false);
        // The page re-reads the session user, so a verified number shows as
        // verified without a second request here.
        router.refresh();
        return;
      }

      const failure = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(failure?.error ?? "That did not work. Please try again.");
    } catch {
      setError("Could not reach Declutter. Please try again.");
    }

    setSubmitting(false);
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send({ code });
  }

  function handlePhoneChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send({ phone: newPhone });
  }

  if (editing) {
    return (
      <form onSubmit={handlePhoneChange} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#1F1F1F]">Phone number</span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            required
            value={newPhone}
            onChange={(event) => setNewPhone(event.target.value)}
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
            type="submit"
            disabled={submitting}
            className="flex h-12 flex-1 items-center justify-center rounded bg-[#1E5F4B] text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Save number
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex h-12 flex-1 items-center justify-center rounded border border-[#B4B4B4] text-[15px] text-[#1F1F1F]"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
      <p className="text-[13px] text-[#6B6B6B]">
        Sending to <span className="font-mono text-[#1F1F1F]">{phone}</span>.{" "}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 text-[#1E5F4B] underline"
        >
          Change number
        </button>
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1F1F1F]">Verification code</span>
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="h-11 rounded border border-[#B4B4B4] px-3 font-mono text-sm text-[#1F1F1F]"
        />
      </label>

      {error && (
        <p role="alert" className="text-[13px] text-[#8A6D2F]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 items-center justify-center rounded bg-[#1E5F4B] text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}
