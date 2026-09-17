/**
 * Checkout. BUY-7.
 *
 * The shell reads the session so the two things that would refuse a deposit
 * are said here, before the buyer reads the terms and presses pay: no account,
 * or an unverified phone number (AUTH-3). The server refuses either way; this
 * only saves the buyer from finding out at the last step.
 *
 * The cart itself lives in localStorage, so its contents are still rendered by
 * `CheckoutView` once the browser has read them.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { getSessionUser } from "@/lib/session";
import { CheckoutView } from "./checkout-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout · Declutter",
};

export default async function CheckoutPage() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
          Pay deposit
        </h1>
        <p className="text-[13px] text-[#6B6B6B]">
          Read the refund terms, then reserve your items with a 10% deposit.
        </p>
      </header>

      {!user && (
        <div className="mt-6 rounded border border-[#1E5F4B] bg-[#F4F8F6] p-4">
          <p className="text-sm font-semibold text-[#1F1F1F]">Sign in to pay a deposit</p>
          <p className="mt-1 text-[13px] text-[#6B6B6B]">
            An order belongs to an account, so we need to know who is buying. Your cart is
            kept while you sign in.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/signin?next=/checkout"
              className="flex h-11 items-center justify-center rounded bg-[#1E5F4B] px-5 text-[13px] font-semibold text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="flex h-11 items-center justify-center rounded border border-[#B4B4B4] px-5 text-[13px] text-[#1F1F1F]"
            >
              Register
            </Link>
          </div>
        </div>
      )}

      {user && !user.phoneVerified && (
        <div className="mt-6 rounded border border-[#D9C9A3] bg-[#FDF6E8] p-4">
          <p className="text-sm font-semibold text-[#6B5324]">Verify your phone first</p>
          <p className="mt-1 text-[13px] text-[#6B5324]">
            AUTH-3: a deposit needs a verified number, so the seller knows there is a
            reachable person behind the order. It takes one step, and any code is accepted in
            this prototype.
          </p>
          <Link
            href="/verify-phone"
            className="mt-3 inline-flex h-11 items-center rounded bg-[#1E5F4B] px-5 text-[13px] font-semibold text-white"
          >
            Verify {user.phone}
          </Link>
        </div>
      )}

      <CheckoutView canPayDeposit={Boolean(user?.phoneVerified)} />
    </main>
  );
}
