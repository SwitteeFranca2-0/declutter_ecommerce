/**
 * Slice 02: the thin vertical tracer.
 *
 * Deliberately plain. It exists to prove that Next.js, Prisma, the migration and
 * the seed are all wired together and that real rows reach a rendered page.
 * Slice 03 replaces it with the real catalogue grid, filter chips and price sort.
 */

import { prisma } from "@/lib/prisma";
import { DEPOSIT_RATE } from "@/lib/item-state";

// Always read the database rather than serving a build-time snapshot.
export const dynamic = "force-dynamic";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default async function Home() {
  const items = await prisma.item.findMany({
    where: { status: "listed" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      category: true,
      condition: true,
      listedPrice: true,
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="border-b border-[#B4B4B4] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1F1F1F]">
          Declutter
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Slice 02. Every layer is wired: these rows come from PostgreSQL through
          Prisma. The catalogue grid arrives in slice 03.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-[#6B6B6B]">
          No listed items. Run <code className="font-mono">npm run db:seed</code>{" "}
          to populate the marketplace.
        </p>
      ) : (
        <>
          <p className="mt-8 font-mono text-xs uppercase tracking-wider text-[#6B6B6B]">
            {items.length} items listed
          </p>
          <ul className="mt-4 divide-y divide-[#B4B4B4] border-y border-[#B4B4B4]">
            {items.map((item) => {
              // Server-side price authority: the deposit is computed here, from
              // the stored price, and never sent up from the client.
              const price = Number(item.listedPrice);
              const deposit = price * DEPOSIT_RATE;

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F1F1F]">
                      {item.title}
                    </p>
                    <p className="font-mono text-xs uppercase tracking-wider text-[#6B6B6B]">
                      {item.category} · {item.condition.replace("_", " ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1F1F1F]">
                      {naira.format(price)}
                    </p>
                    <p className="font-mono text-xs text-[#6B6B6B]">
                      {naira.format(deposit)} deposit
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
