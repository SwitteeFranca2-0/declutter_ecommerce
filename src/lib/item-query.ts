/**
 * Catalogue query parameters.
 *
 * Declared here rather than inside the route handler so the same schema
 * validates the URL on the server and shapes the query string the client
 * builds. One definition, no drift.
 */

import { z } from "zod";

export const CATEGORIES = [
  "electronics",
  "furniture",
  "appliances",
  "fashion",
  "books",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

/**
 * Attacker-controlled input: this is a query string. Unknown categories and
 * sorts are rejected rather than coerced, so a crafted value cannot widen the
 * query beyond listed items.
 */
export const catalogueQuerySchema = z.object({
  // Absent or "all" both mean no category filter.
  category: z.enum(CATEGORIES).optional(),
  sort: z.enum(SORTS).default("newest"),
});

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

/** Parse a URLSearchParams, treating "all" and empty values as absent. */
export function parseCatalogueQuery(params: URLSearchParams | Record<string, string | undefined>) {
  const get = (key: string) =>
    params instanceof URLSearchParams ? params.get(key) : params[key];

  const rawCategory = get("category");
  const rawSort = get("sort");

  return catalogueQuerySchema.safeParse({
    category: rawCategory && rawCategory !== "all" ? rawCategory : undefined,
    sort: rawSort || undefined,
  });
}

export const CATEGORY_LABELS: Record<Category, string> = {
  electronics: "Electronics",
  furniture: "Furniture",
  appliances: "Appliances",
  fashion: "Fashion",
  books: "Books",
  other: "Other",
};

export const CONDITION_LABELS: Record<string, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

export const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest first",
  price_asc: "Price, low to high",
  price_desc: "Price, high to low",
};
