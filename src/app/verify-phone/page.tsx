/**
 * Phone verification. AUTH-3.
 *
 * Server shell: it reads the session so a signed-out visitor is sent to sign
 * in, and an already verified user is told so rather than being asked again.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";
import { VerifyPhoneForm } from "./verify-phone-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your phone · Declutter",
};

export default async function VerifyPhonePage() {
  const user = await getSessionUser();

  if (!user) redirect("/signin?next=/verify-phone");

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
        Verify your phone
      </h1>
      <p className="mt-1.5 text-[13px] text-[#6B6B6B]">
        Required before you can list an item or pay a deposit.
      </p>

      {/* Said plainly: nothing is sent, and any code is accepted. */}
      <p className="mt-4 rounded border border-[#D9C9A3] bg-[#FDF6E8] p-3 text-[13px] leading-relaxed text-[#6B5324]">
        <strong className="font-semibold">Simulated verification.</strong> This course
        prototype sends no text message. Type any code and it will be accepted.
      </p>

      {user.phoneVerified ? (
        <div className="mt-6 rounded border border-[#1E5F4B] bg-[#F4F8F6] p-4">
          <p className="text-sm font-semibold text-[#1E5F4B]">
            {user.phone} is verified
          </p>
          <p className="mt-1 text-[13px] text-[#6B6B6B]">
            You can list items and pay deposits.
          </p>
          <Link href="/" className="mt-3 inline-block text-[13px] text-[#1E5F4B] underline">
            Back to the marketplace
          </Link>
        </div>
      ) : (
        <VerifyPhoneForm phone={user.phone} />
      )}
    </main>
  );
}
