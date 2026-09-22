"use client";

/**
 * The sign-in form.
 *
 * Hands the credentials to NextAuth and stays on the page on failure, so the
 * reason can be shown next to the fields. The message is the same for an
 * unknown email and a wrong password: the form must not be usable to discover
 * who has an account.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

/** Only ever an in-app path, so a crafted `next` cannot redirect off-site. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.ok) {
      router.push(next);
      router.refresh();
      return;
    }

    setError("That email address and password do not match an account.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1F1F1F]">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded border border-[#B4B4B4] px-3 text-sm text-[#1F1F1F]"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1F1F1F]">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 rounded border border-[#B4B4B4] px-3 text-sm text-[#1F1F1F]"
        />
      </label>

      {error && (
        <p role="alert" className="rounded border border-[#D9C9A3] bg-[#FDF6E8] p-2.5 text-[13px] text-[#6B5324]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 items-center justify-center rounded bg-[#1E5F4B] text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-xs leading-relaxed text-[#6B6B6B]">
        Demo accounts are listed in the README, all with the password{" "}
        <span className="font-mono">declutter</span>. See{" "}
        <Link href="/" className="text-[#1E5F4B] underline">
          the marketplace
        </Link>{" "}
        to browse without an account.
      </p>
    </form>
  );
}
