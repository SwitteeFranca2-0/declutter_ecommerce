/**
 * GET /api/items
 *
 * The JSON endpoint behind the category filter. This is one of the two
 * assessed asynchronous interactions: the catalogue page calls it with `fetch`
 * and re-renders the grid without a page reload. It is deliberately a route
 * handler rather than a server action, because the course examines the
 * DOM/AJAX/JSON exchange directly and a server action would hide it.
 *
 * Query: ?category=<one of six>&sort=newest|price_asc|price_desc
 */

import { NextResponse } from "next/server";

import { getListedItems } from "@/lib/items";
import { parseCatalogueQuery } from "@/lib/item-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Validate at the boundary, before anything reaches a query.
  const parsed = parseCatalogueQuery(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query",
        // Field-level detail, not the raw Zod dump, which leaks internals.
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "query",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const items = await getListedItems(parsed.data);

  return NextResponse.json({
    items,
    count: items.length,
    query: parsed.data,
  });
}
