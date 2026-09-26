/**
 * Item detail. BUY-3.
 *
 * Layout follows the "2 · Item detail" wireframe: gallery left, buy panel
 * right, stacking to one column on phone with the gallery first.
 *
 * Every figure shown is derived on the server from the stored listed price.
 * Nothing here is computed in the browser.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getListedItem } from "@/lib/items";
import { getSessionUser } from "@/lib/session";
import { formatNaira } from "@/lib/pricing";
import { HOLD_DURATION_HOURS } from "@/lib/item-state";
import { Gallery } from "./gallery";
import { AddToCart } from "./add-to-cart";
import { AskQuestion } from "./ask-question";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electronics",
  furniture: "Furniture",
  appliances: "Appliances",
  fashion: "Fashion",
  books: "Books",
  other: "Other",
};

const CONDITION_LABELS: Record<string, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await getListedItem(id);
  // React escapes this on render; it is plain text in a meta tag here.
  return { title: item ? `${item.title} · Declutter` : "Item unavailable · Declutter" };
}

export default async function ItemDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const item = await getListedItem(id);
  const viewer = await getSessionUser();

  // Null covers both "no such item" and "no longer listed". The buyer sees the
  // same page either way, so the difference cannot be used to discover which
  // items exist.
  if (!item) notFound();

  // Carries the buyer's filter back to where they came from. Nothing sets it
  // until slice 03; until then the link simply returns to the catalogue.
  const query = await searchParams;
  const category = typeof query.category === "string" ? query.category : undefined;
  const backHref = category ? `/?category=${encodeURIComponent(category)}` : "/";
  const backLabel = category
    ? `Back to ${CATEGORY_LABELS[category] ?? "the marketplace"}`
    : "Back to the marketplace";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-12">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-[#1E5F4B] hover:underline"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        {backLabel}
      </Link>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-12">
        <div className="w-full lg:max-w-[640px] lg:flex-none">
          <Gallery images={item.images} title={item.title} />
        </div>

        <div className="flex w-full flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6B6B]">
                {CATEGORY_LABELS[item.category] ?? item.category}
              </span>
              <span className="rounded-[3px] border border-[#B4B4B4] px-[7px] py-0.5 text-[10px] text-[#6B6B6B]">
                {CONDITION_LABELS[item.condition] ?? item.condition}
              </span>
            </div>

            {/* User-supplied. React escapes it; never dangerouslySetInnerHTML. */}
            <h1 className="text-2xl font-semibold leading-tight tracking-[-0.015em] text-[#1F1F1F]">
              {item.title}
            </h1>

            <p className="text-3xl font-semibold tracking-[-0.02em] text-[#1F1F1F]">
              {formatNaira(item.listedPrice)}
            </p>
          </div>

          {/* What the buyer actually pays today, before any commitment. */}
          <div className="flex flex-col gap-2.5 rounded border border-[#1E5F4B] bg-[#F4F8F6] p-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold text-[#1F1F1F]">Pay today to reserve</span>
              <span className="text-base font-semibold text-[#1F1F1F]">
                {formatNaira(item.deposit)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[13px] text-[#6B6B6B]">Balance on collection</span>
              <span className="font-mono text-[13px] text-[#6B6B6B]">
                {formatNaira(item.balance)}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[#6B6B6B]">
              A 10% deposit holds this item for {HOLD_DURATION_HOURS} hours. Refund terms are
              shown in full before you pay.
            </p>
          </div>

          <AddToCart itemId={item.id} />

          {/* BUY-4: a question costs nothing and reveals nothing. */}
          <div className="flex flex-col gap-2.5 border-t border-[#E8E8E8] pt-4">
            <h2 className="text-[15px] font-semibold text-[#1F1F1F]">
              Not sure? Ask before you commit
            </h2>
            <AskQuestion
              itemId={item.id}
              canAsk={viewer?.role === "buyer"}
              signedIn={Boolean(viewer)}
              verified={Boolean(viewer?.phoneVerified)}
            />
          </div>

          <div className="flex items-start gap-2.5 rounded border border-dashed border-[#B4B4B4] p-3.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6B6B6B"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 flex-none"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="text-xs leading-relaxed text-[#6B6B6B]">
              Declutter holds your payment until you collect. The seller&rsquo;s identity stays
              hidden until a deposit is placed.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <h2 className="text-[15px] font-semibold text-[#1F1F1F]">Description</h2>
            {/* whitespace-pre-line keeps the seller's paragraphs without
                interpreting anything in their text as markup. */}
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#1F1F1F]">
              {item.description}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
