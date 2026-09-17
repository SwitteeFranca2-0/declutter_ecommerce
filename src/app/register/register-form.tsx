"use client";

/**
 * The registration form.
 *
 * Posts to `POST /api/register`, then signs the new account in so nobody has
 * to type their credentials twice, and sends them to phone verification, which
 * is the next thing standing between them and listing or buying (AUTH-3).
 *
 * Field-level messages come from the route's Zod issues, so the rules the
 * server enforces are the rules the buyer is shown. There is no second copy of
 * them here to drift.
 */

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

type FieldError = { field: string; message: string };

const ROLES = [
  { value: "buyer", label: "I am buying" },
  { value: "seller", label: "I am selling" },
] as const;

export function RegisterForm() {
  const router = useRouter();

  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [values, setValues] = useState({
    firstName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message;

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);
    setFormError(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, role }),
      });

      const body: unknown = await response.json().catch(() => null);

      if (response.status === 201) {
        // Sign in with the credentials just used, so the new account is not
        // asked for them a second time.
        await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
        });
        router.push("/verify-phone");
        router.refresh();
        return;
      }

      const failure = (body ?? {}) as { error?: string; details?: FieldError[] };
      setErrors(failure.details ?? []);
      setFormError(failure.details?.length ? null : (failure.error ?? "Could not register."));
    } catch {
      setFormError("Could not reach Declutter. Please try again.");
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-medium text-[#1F1F1F]">
          What brings you here?
        </legend>
        <div className="flex gap-2">
          {ROLES.map((option) => (
            <label
              key={option.value}
              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded border px-3 text-[13px] ${
                role === option.value
                  ? "border-[#1E5F4B] bg-[#F4F8F6] font-semibold text-[#1E5F4B]"
                  : "border-[#B4B4B4] text-[#1F1F1F]"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="First name"
        name="firstName"
        autoComplete="given-name"
        value={values.firstName}
        onChange={(value) => update("firstName", value)}
        error={errorFor("firstName")}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(value) => update("email", value)}
        error={errorFor("email")}
      />
      <Field
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        hint="Verified in the next step. Never shown to a buyer before a deposit."
        value={values.phone}
        onChange={(value) => update("phone", value)}
        error={errorFor("phone")}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        value={values.password}
        onChange={(value) => update("password", value)}
        error={errorFor("password")}
      />

      {formError && (
        <p role="alert" className="rounded border border-[#D9C9A3] bg-[#FDF6E8] p-2.5 text-[13px] text-[#6B5324]">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 items-center justify-center rounded bg-[#1E5F4B] text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-[#1F1F1F]">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className={`h-11 rounded border px-3 text-sm text-[#1F1F1F] ${
          error ? "border-[#8A6D2F]" : "border-[#B4B4B4]"
        }`}
      />
      {hint && (
        <span id={hintId} className="text-xs text-[#6B6B6B]">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-xs text-[#8A6D2F]">
          {error}
        </span>
      )}
    </label>
  );
}
