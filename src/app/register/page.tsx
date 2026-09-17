/**
 * Register. AUTH-1.
 *
 * Email, phone, password and first name. No identity documents are requested
 * at any point: PRD §10.3, a data minimisation decision under GDPR
 * Art. 5(1)(c).
 */

import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register · Declutter",
};

export default function RegisterPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#1F1F1F] sm:text-[26px]">
        Create an account
      </h1>
      <p className="mt-1.5 text-[13px] text-[#6B6B6B]">
        We ask for an email address and a phone number. No identity documents, ever.
      </p>

      <RegisterForm />

      <p className="mt-6 text-[13px] text-[#6B6B6B]">
        Already registered?{" "}
        <Link href="/signin" className="text-[#1E5F4B] underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
