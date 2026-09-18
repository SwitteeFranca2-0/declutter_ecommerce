"use client";

/**
 * The submission form. SELL-1.
 *
 * Posts multipart form data to `POST /api/items` with `fetch`, so the page does
 * not reload and the seller keeps what they typed when a field is refused.
 * Field messages come from the route's own validation, so there is no second
 * copy of the rules here to drift from the server's.
 *
 * Photographs are chosen, previewed and reorderable before anything is sent.
 * The first one is the card thumbnail, which is what the lowest sortOrder means
 * everywhere else in the application.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { MAX_FILES } from "@/lib/upload-limits";

type FieldError = { field: string; message: string };

const CATEGORIES = [
  ["electronics", "Electronics"],
  ["furniture", "Furniture"],
  ["appliances", "Appliances"],
  ["fashion", "Fashion"],
  ["books", "Books"],
  ["other", "Other"],
] as const;

const CONDITIONS = [
  ["like_new", "Like new"],
  ["good", "Good"],
  ["fair", "Fair"],
] as const;

export function SubmissionForm() {
  const router = useRouter();

  const [values, setValues] = useState({
    title: "",
    description: "",
    category: "electronics",
    condition: "good",
    requestedPayout: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Derived during render rather than set from an effect, which would render
  // twice for every photograph added. The effect only cleans up: each object
  // URL is revoked when the selection changes, so previews do not leak memory
  // as a seller swaps photographs around.
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message;

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    setFiles((current) => [...current, ...Array.from(selected)].slice(0, MAX_FILES));
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function makeFirst(index: number) {
    setFiles((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      return [moved, ...next];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);
    setFormError(null);
    setDone(null);

    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.append(key, value);
    for (const file of files) form.append("images", file);

    try {
      const response = await fetch("/api/items", { method: "POST", body: form });
      const body: unknown = await response.json().catch(() => null);

      if (response.status === 201) {
        const { item } = body as { item: { title: string } };
        setDone(item.title);
        setValues({
          title: "",
          description: "",
          category: "electronics",
          condition: "good",
          requestedPayout: "",
        });
        setFiles([]);
        // Refreshes the server-rendered submissions list below the form.
        router.refresh();
        setSubmitting(false);
        return;
      }

      const failure = (body ?? {}) as { error?: string; details?: FieldError[] };
      setErrors(failure.details ?? []);
      setFormError(failure.details?.length ? null : (failure.error ?? "Could not submit."));
    } catch {
      setFormError("Could not reach Declutter. Please try again.");
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      {done && (
        <p
          role="status"
          className="rounded border border-[#1E5F4B] bg-[#F4F8F6] p-3 text-[13px] text-[#1E5F4B]"
        >
          <strong className="font-semibold">{done}</strong> is with Declutter for review. It
          reaches the marketplace once it has been checked and priced.
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1F1F1F]">Title</span>
        <input
          type="text"
          name="title"
          required
          maxLength={120}
          value={values.title}
          onChange={(event) => update("title", event.target.value)}
          aria-invalid={errorFor("title") ? true : undefined}
          className={`h-11 rounded border px-3 text-sm text-[#1F1F1F] ${
            errorFor("title") ? "border-[#8A6D2F]" : "border-[#B4B4B4]"
          }`}
        />
        {errorFor("title") && (
          <span className="text-xs text-[#8A6D2F]">{errorFor("title")}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1F1F1F]">Description</span>
        <textarea
          name="description"
          required
          rows={5}
          maxLength={4000}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          aria-invalid={errorFor("description") ? true : undefined}
          className={`rounded border p-3 text-sm leading-relaxed text-[#1F1F1F] ${
            errorFor("description") ? "border-[#8A6D2F]" : "border-[#B4B4B4]"
          }`}
        />
        <span className="text-xs text-[#6B6B6B]">
          Faults included. A buyer who knows what to expect is a handover that goes ahead.
        </span>
        {errorFor("description") && (
          <span className="text-xs text-[#8A6D2F]">{errorFor("description")}</span>
        )}
      </label>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#1F1F1F]">Category</span>
          <select
            name="category"
            value={values.category}
            onChange={(event) => update("category", event.target.value)}
            className="h-11 rounded border border-[#B4B4B4] bg-white px-3 text-sm text-[#1F1F1F]"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[#1F1F1F]">Condition</span>
          <select
            name="condition"
            value={values.condition}
            onChange={(event) => update("condition", event.target.value)}
            className="h-11 rounded border border-[#B4B4B4] bg-white px-3 text-sm text-[#1F1F1F]"
          >
            {CONDITIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-[#1F1F1F]">
          The payout you want, in Naira
        </span>
        <input
          type="text"
          name="requestedPayout"
          inputMode="decimal"
          required
          placeholder="45000"
          value={values.requestedPayout}
          onChange={(event) => update("requestedPayout", event.target.value)}
          aria-invalid={errorFor("requestedPayout") ? true : undefined}
          className={`h-11 rounded border px-3 font-mono text-sm text-[#1F1F1F] ${
            errorFor("requestedPayout") ? "border-[#8A6D2F]" : "border-[#B4B4B4]"
          }`}
        />
        <span className="text-xs text-[#6B6B6B]">
          This is what reaches you after a completed handover, not the price a buyer sees.
        </span>
        {errorFor("requestedPayout") && (
          <span className="text-xs text-[#8A6D2F]">{errorFor("requestedPayout")}</span>
        )}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-medium text-[#1F1F1F]">
          Photographs, up to {MAX_FILES}
        </legend>

        <input
          ref={fileInput}
          type="file"
          name="images"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          onChange={(event) => addFiles(event.target.files)}
          className="min-h-11 text-[13px] text-[#1F1F1F] file:mr-3 file:h-9 file:rounded file:border file:border-[#B4B4B4] file:bg-white file:px-3 file:text-[13px]"
        />

        {errorFor("images") && (
          <span className="text-xs text-[#8A6D2F]">{errorFor("images")}</span>
        )}

        {files.length > 0 && (
          <ul className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex flex-col gap-1.5">
                <div className="relative aspect-square overflow-hidden rounded border border-[#B4B4B4] bg-[#E8E8E8]">
                  {previews[index] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[index]}
                      alt={`Photograph ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded-[3px] bg-[#1E5F4B] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Cover
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  {index === 0 ? (
                    <span className="text-[11px] text-[#6B6B6B]">Shown on the card</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeFirst(index)}
                      className="min-h-11 text-[11px] text-[#1E5F4B] underline"
                    >
                      Make cover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="min-h-11 text-[11px] text-[#6B6B6B] underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

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
        {submitting ? "Sending for review…" : "Submit for review"}
      </button>

      <p className="text-xs leading-relaxed text-[#6B6B6B]">
        Nothing appears on the marketplace until Declutter has reviewed it. You can follow its
        progress below.
      </p>
    </form>
  );
}
