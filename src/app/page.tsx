/**
 * The marketplace listing.
 *
 * Still the plain list from slice 02, now linking to detail pages so the
 * journey is navigable. Slice 03 replaces it with the real grid, category
 * filter chips and price sort.
 */

import Link from "next/link";

import { getListedItems } from "@/lib/items";
import { formatNaira } from "@/lib/pricing";

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

export default async function Home() {
  const items = await getListedItems();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="border-b border-[#B4B4B4] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1F1F1F]">Declutter</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Every item is checked and priced by Declutter before it appears here. The grid and
          category filter arrive in the next slice.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-[#6B6B6B]">
          No listed items. Run <code className="font-mono">npm run db:seed</code> to populate
          the marketplace.
        </p>
      ) : (
        <>
          <p className="mt-8 font-mono text-xs uppercase tracking-wider text-[#6B6B6B]">
            {items.length} items listed
          </p>
          <ul className="mt-4 divide-y divide-[#B4B4B4] border-y border-[#B4B4B4]">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 hover:bg-[#F7F7F7]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F1F1F]">{item.title}</p>
                    <p className="font-mono text-xs uppercase tracking-wider text-[#6B6B6B]">
                      {CATEGORY_LABELS[item.category] ?? item.category} ·{" "}
                      {CONDITION_LABELS[item.condition] ?? item.condition}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1F1F1F]">
                      {formatNaira(item.listedPrice)}
                    </p>
                    <p className="font-mono text-xs text-[#6B6B6B]">
                      {formatNaira(item.deposit)} deposit
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
