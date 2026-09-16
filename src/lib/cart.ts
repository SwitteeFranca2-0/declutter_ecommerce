/**
 * The cart.
 *
 * A pure module over an injectable storage interface. It holds item
 * identifiers and nothing else: never a price, never a title, never a
 * quantity.
 *
 * Three reasons, in order of importance:
 *
 * 1. **Prices are read fresh.** A price stored here would go stale the moment
 *    an admin re-prices an item, and a buyer must never see a figure the
 *    server will not honour. PRD §10.4.
 * 2. **Quantity is meaningless.** Every listing is a unique single item, so a
 *    cart of three items produces three orders. There is no `order_items`
 *    table and no count to keep.
 * 3. **It is testable without a DOM.** Storage is injected, so this module is
 *    one of the project's three test seams and needs no jsdom.
 *
 * Every function is total: given any input, including corrupted storage, it
 * returns a valid cart rather than throwing. A buyer with a broken
 * localStorage entry sees an empty cart, not a broken page.
 */

/** The slice of the Storage API this module needs. */
export type CartStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const CART_STORAGE_KEY = "declutter.cart.v1";

/** Item identifiers, in the order they were added. */
export type Cart = readonly string[];

export const EMPTY_CART: Cart = [];

/** cuid-shaped. Rejects anything that could not be an id we issued. */
function isPlausibleId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

/**
 * Read the cart.
 *
 * Returns an empty cart for every failure mode: no entry, malformed JSON, a
 * JSON value that is not an array, entries that are not strings, or storage
 * that throws. Private browsing modes and disabled site data both throw on
 * access, so this cannot be a try-free read.
 */
export function readCart(storage: CartStorage): Cart {
  let raw: string | null;

  try {
    raw = storage.getItem(CART_STORAGE_KEY);
  } catch {
    return EMPTY_CART;
  }

  if (!raw) return EMPTY_CART;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_CART;

    // Drop anything malformed rather than failing the whole cart: one bad
    // entry should not lose a buyer's other selections.
    const ids = parsed.filter(isPlausibleId);
    return dedupe(ids);
  } catch {
    return EMPTY_CART;
  }
}

/**
 * Write the cart.
 *
 * Returns whether it persisted. A full or unavailable storage quota is a real
 * possibility and is not an error the buyer can act on, so callers keep the
 * in-memory cart and carry on.
 */
export function writeCart(storage: CartStorage, cart: Cart): boolean {
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    return true;
  } catch {
    return false;
  }
}

function dedupe(ids: readonly string[]): Cart {
  return Array.from(new Set(ids));
}

/**
 * Add an item.
 *
 * Adding the same item twice is a no-op, not a second line. Quantity is
 * meaningless when every listing is a unique single item, and two lines for
 * one item would imply the buyer could purchase it twice.
 */
export function addItem(cart: Cart, id: string): Cart {
  if (!isPlausibleId(id)) return cart;
  if (cart.includes(id)) return cart;
  return [...cart, id];
}

export function removeItem(cart: Cart, id: string): Cart {
  return cart.filter((existing) => existing !== id);
}

export function hasItem(cart: Cart, id: string): boolean {
  return cart.includes(id);
}

export function countItems(cart: Cart): number {
  return cart.length;
}

/** Drop several at once, used after a successful checkout. */
export function removeItems(cart: Cart, ids: readonly string[]): Cart {
  const gone = new Set(ids);
  return cart.filter((id) => !gone.has(id));
}
