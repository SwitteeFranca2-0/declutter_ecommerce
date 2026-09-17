/**
 * Sign in. AUTH-4.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "./signin-form";

export const metadata: Metadata = {
  title: "Sign in · Declutter",
};

export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
        Sign in
      </h1>
      <p className="mt-1.5 text-[13px] text-[#6B6B6B]">
        Your cart stays where it is while you sign in.
      </p>

      <SignInForm />

      <p className="mt-6 text-[13px] text-[#6B6B6B]">
        No account yet?{" "}
        <Link href="/register" className="text-[#1E5F4B] underline">
          Register
        </Link>
      </p>
    </main>
  );
}
