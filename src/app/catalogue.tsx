"use client";

/**
 * The catalogue grid and its filter.
 *
 * ── ASSESSED AJAX ─────────────────────────────────────────────────────────
 * Changing the category or the sort calls `GET /api/items` with the browser's
 * `fetch`, parses the JSON, and replaces the grid in place. No page reload, no
 * form submission, no server action.
 *
 * This is deliberately written out rather than hidden behind a data-fetching
 * library or a server action, because the course assesses DOM, AJAX and JSON
 * outcomes directly. See the README's "where AJAX is used" section.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * The first render uses items fetched on the server, so the page is complete
 * before any JavaScript runs and works with JavaScript disabled.
 */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ItemView } from "@/lib/items";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITION_LABELS,
  SORTS,
  SORT_LABELS,
  type Category,
  type Sort,
} from "@/lib/item-query";
import { formatNaira } from "@/lib/pricing";

type Props = { initialItems: ItemView[] };

export function Catalogue({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skip the fetch on first render: the server already provided these items.
  const firstRender = useRef(true);
  // A slow response for an old filter must not overwrite a newer one.
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async (nextCategory: Category | "all", nextSort: Sort) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (nextCategory !== "all") params.set("category", nextCategory);
      params.set("sort", nextSort);

      const response = await fetch(`/api/items?${params.toString()}`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Request failed with ${response.status}`);

      const data: { items: ItemView[] } = await response.json();
      setItems(data.items);
    } catch (cause) {
      // An aborted request is a newer one superseding it, not a failure.
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Could not load items. Check your connection and try again.");
    } finally {
      if (inFlight.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void load(category, sort);
  }, [category, sort, load]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Chips scroll sideways on phone rather than wrapping into rows. */}
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {(["all", ...CATEGORIES] as const).map((value) => {
            const active = value === category;
            return (
              <li key={value} className="flex-none">
                <button
                  type="button"
                  onClick={() => setCategory(value)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-full border px-3.5 text-[13px] transition-colors ${
                    active
                      ? "border-[#2A2D64] bg-[#2A2D64] font-medium text-white"
                      : "border-[#DDDEE9] text-[#12142B] hover:border-[#6B6E84]"
                  }`}
                >
                  {value === "all" ? "All" : CATEGORY_LABELS[value]}
                </button>
              </li>
            );
          })}
        </ul>

        <label className="flex flex-none items-center gap-2.5 rounded-lg border border-[#DDDEE9] bg-white px-3.5 py-2">
          <span className="text-[13px] text-[#6B6E84]">Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className="bg-transparent text-[13px] font-medium text-[#12142B] outline-none"
          >
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p
        className="mt-4 font-mono text-xs uppercase tracking-wider text-[#6B6E84]"
        // Announce the new count to screen readers when the grid changes.
        aria-live="polite"
      >
        {loading ? "Loading…" : `${items.length} ${items.length === 1 ? "item" : "items"}`}
      </p>

      {error && (
        <div className="mt-4 rounded border border-[#DDDEE9] bg-[#F4F4F8] p-4">
          <p className="text-sm text-[#12142B]">{error}</p>
          <button
            type="button"
            onClick={() => void load(category, sort)}
            className="mt-2 text-sm text-[#2A2D64] underline"
          >
            Try again
          </button>
        </div>
      )}

      {!error && items.length === 0 ? (
        <div className="mt-6 rounded border border-dashed border-[#DDDEE9] p-10 text-center">
          <p className="text-sm font-medium text-[#12142B]">
            Nothing in {category === "all" ? "the marketplace" : CATEGORY_LABELS[category]} yet
          </p>
          <p className="mt-1.5 text-[13px] text-[#6B6E84]">
            Items appear here once an admin has reviewed and priced them.
          </p>
          {category !== "all" && (
            <button
              type="button"
              onClick={() => setCategory("all")}
              className="mt-3 text-[13px] text-[#2A2D64] underline"
            >
              Show everything
            </button>
          )}
        </div>
      ) : (
        <ul
          className={`mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${
            loading ? "opacity-60" : ""
          }`}
        >
          {items.map((item) => (
            <ItemCard key={item.id} item={item} category={category} />
          ))}
        </ul>
      )}
    </>
  );
}

function ItemCard({ item, category }: { item: ItemView; category: Category | "all" }) {
  // Lowest sortOrder leads, so it is the thumbnail.
  const thumbnail = item.images[0];
  // Carry the active filter so the detail page can offer a back link to it.
  const href =
    category === "all" ? `/items/${item.id}` : `/items/${item.id}?category=${category}`;

  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col overflow-hidden rounded-lg border border-[#DDDEE9] bg-white transition-colors hover:border-[#6B6E84]"
      >
        <div className="relative aspect-[4/3] w-full bg-[#EDEEF6]">
          {thumbnail && (
            <Image
              src={thumbnail.url}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6E84]">
              {CATEGORY_LABELS[item.category as Category] ?? item.category}
            </span>
            <span className="rounded-[3px] border border-[#DDDEE9] px-[7px] py-0.5 text-[10px] text-[#6B6E84]">
              {CONDITION_LABELS[item.condition] ?? item.condition}
            </span>
          </div>

          {/* User-supplied. React escapes it. */}
          <p className="text-[15px] font-semibold leading-snug text-[#12142B]">{item.title}</p>

          <div className="mt-auto flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-[#12142B]">
              {formatNaira(item.listedPrice)}
            </span>
            <span className="font-mono text-[11px] text-[#6B6E84]">
              {formatNaira(item.deposit)} deposit
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
