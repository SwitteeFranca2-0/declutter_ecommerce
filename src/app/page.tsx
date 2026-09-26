/**
 * The marketplace. BUY-1, BUY-2.
 *
 * Items are fetched on the server for the first render, so the page is
 * complete before any JavaScript runs. The filter and sort then re-render the
 * grid client-side through `fetch`; see `catalogue.tsx`.
 */

import { getListedItems } from "@/lib/items";
import { Catalogue } from "./catalogue";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await getListedItems();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="flex flex-col gap-1.5 border-b border-[#DDDEE9] pb-5">
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[#12142B] sm:text-[26px]">
          Marketplace
        </h1>
        <p className="text-[13px] leading-relaxed text-[#6B6E84]">
          Every item is checked and priced by Declutter before it appears here. A 10% deposit
          reserves an item while you arrange collection.
        </p>
      </header>

      <Catalogue initialItems={items} />
    </main>
  );
}
