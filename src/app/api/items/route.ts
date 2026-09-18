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
import { createSubmission, submissionSchema } from "@/lib/listings";
import { requireUser } from "@/lib/session";
import { discardUploads, saveItemImages } from "@/lib/uploads";

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

/**
 * POST /api/items
 *
 * A verified seller offers an item. SELL-1.
 *
 * Multipart, because a submission carries photographs. The item lands in
 * `pending_review`: not on the marketplace, not buyable, invisible to buyers
 * until an admin approves and prices it in slice 09.
 *
 * - 201 with the submitted item
 * - 400 on validation, including a file that is not the image it claims to be
 * - 401 signed out, 403 for a buyer or an unverified seller (AUTH-3, AUTH-6)
 *
 * Nothing about status, price, ownership or approval is read from the body.
 */
export async function POST(request: Request) {
  // Guard first: role, then the verified-phone requirement, before a single
  // byte is written to disk.
  const guard = await requireUser({ role: "seller", verifiedPhone: true });
  if (!guard.ok) return guard.response;

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a form submission with photographs." },
      { status: 400 },
    );
  }

  const fields = Object.fromEntries(
    ["title", "description", "category", "condition", "requestedPayout"].map((key) => [
      key,
      typeof form.get(key) === "string" ? (form.get(key) as string) : "",
    ]),
  );

  // Validate the text before touching the files, so a typo does not cost an
  // upload.
  const parsed = submissionSchema.safeParse(fields);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check the details of your listing",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "body",
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const files = form.getAll("images").filter((value): value is File => value instanceof File);

  const uploaded = await saveItemImages(files);

  if (!uploaded.ok) {
    return NextResponse.json(
      { error: uploaded.reason, details: [{ field: "images", message: uploaded.reason }] },
      { status: 400 },
    );
  }

  try {
    const item = await createSubmission(guard.user.id, parsed.data, uploaded.urls);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    // No orphaned files: if the row cannot be written, the photographs go too.
    await discardUploads(uploaded.urls);
    throw error;
  }
}
