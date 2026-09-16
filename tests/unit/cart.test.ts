/**
 * The cart module, tested directly.
 *
 * The second of this project's three test seams. Cart state lives in
 * localStorage and is therefore invisible at the route-handler seam, so the
 * module is pure over an injectable storage interface and tested here without
 * a DOM.
 *
 * The corruption cases are the point. A buyer with a broken storage entry must
 * see an empty cart, never a broken page.
 */

import { describe, expect, it } from "vitest";
import {
  addItem,
  CART_STORAGE_KEY,
  countItems,
  EMPTY_CART,
  hasItem,
  readCart,
  removeItem,
  removeItems,
  writeCart,
  type CartStorage,
} from "@/lib/cart";

/** An in-memory stand-in for localStorage. */
function fakeStorage(initial?: string): CartStorage & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() {
      return this.value;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
}

/** Storage that throws on every access, as a private window does. */
const hostileStorage: CartStorage = {
  getItem() {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem() {
    throw new DOMException("Quota exceeded.", "QuotaExceededError");
  },
};

describe("adding", () => {
  it("adds an item", () => {
    expect(addItem(EMPTY_CART, "item-1")).toEqual(["item-1"]);
  });

  it("keeps the order items were added in", () => {
    let cart = EMPTY_CART;
    cart = addItem(cart, "a");
    cart = addItem(cart, "b");
    cart = addItem(cart, "c");
    expect(cart).toEqual(["a", "b", "c"]);
  });

  it("is a no-op when the same item is added twice", () => {
    // Every listing is a unique single item: a second line would imply the
    // buyer could purchase it twice.
    let cart = addItem(EMPTY_CART, "item-1");
    cart = addItem(cart, "item-1");
    expect(cart).toEqual(["item-1"]);
    expect(countItems(cart)).toBe(1);
  });

  it("ignores an empty id", () => {
    expect(addItem(EMPTY_CART, "")).toEqual([]);
  });

  it("ignores an absurdly long id", () => {
    expect(addItem(EMPTY_CART, "x".repeat(200))).toEqual([]);
  });

  it("does not mutate the cart it was given", () => {
    const before = addItem(EMPTY_CART, "a");
    const after = addItem(before, "b");
    expect(before).toEqual(["a"]);
    expect(after).toEqual(["a", "b"]);
  });
});

describe("removing", () => {
  it("removes an item", () => {
    expect(removeItem(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("is a no-op for an item not in the cart", () => {
    expect(removeItem(["a"], "z")).toEqual(["a"]);
  });

  it("removes several at once, as checkout does", () => {
    expect(removeItems(["a", "b", "c", "d"], ["b", "d"])).toEqual(["a", "c"]);
  });

  it("leaves unavailable items behind when only the ordered ones are removed", () => {
    expect(removeItems(["ordered", "unavailable"], ["ordered"])).toEqual(["unavailable"]);
  });
});

describe("inspecting", () => {
  it("reports membership", () => {
    expect(hasItem(["a"], "a")).toBe(true);
    expect(hasItem(["a"], "b")).toBe(false);
  });

  it("counts", () => {
    expect(countItems(EMPTY_CART)).toBe(0);
    expect(countItems(["a", "b"])).toBe(2);
  });
});

describe("reading from storage", () => {
  it("returns an empty cart when nothing is stored", () => {
    expect(readCart(fakeStorage())).toEqual([]);
  });

  it("reads a stored cart", () => {
    expect(readCart(fakeStorage(JSON.stringify(["a", "b"])))).toEqual(["a", "b"]);
  });

  it("round-trips through write and read", () => {
    const storage = fakeStorage();
    writeCart(storage, ["a", "b"]);
    expect(readCart(storage)).toEqual(["a", "b"]);
  });

  it("stores identifiers only, never prices", () => {
    const storage = fakeStorage();
    writeCart(storage, ["item-1"]);
    expect(storage.value).toBe('["item-1"]');
    expect(storage.value).not.toContain("price");
  });
});

describe("recovering from corrupted storage", () => {
  it("survives malformed JSON", () => {
    expect(readCart(fakeStorage("not json at all"))).toEqual([]);
  });

  it("survives a JSON value that is not an array", () => {
    expect(readCart(fakeStorage('{"cart":["a"]}'))).toEqual([]);
    expect(readCart(fakeStorage('"a"'))).toEqual([]);
    expect(readCart(fakeStorage("42"))).toEqual([]);
    expect(readCart(fakeStorage("null"))).toEqual([]);
  });

  it("drops malformed entries but keeps the good ones", () => {
    // One bad entry must not lose the buyer's other selections.
    expect(readCart(fakeStorage(JSON.stringify(["a", 42, null, "b", {}])))).toEqual(["a", "b"]);
  });

  it("removes duplicates that reached storage somehow", () => {
    expect(readCart(fakeStorage(JSON.stringify(["a", "a", "b"])))).toEqual(["a", "b"]);
  });

  it("survives an empty string", () => {
    expect(readCart(fakeStorage(""))).toEqual([]);
  });

  it("survives storage that throws on read, as a private window does", () => {
    expect(readCart(hostileStorage)).toEqual([]);
  });

  it("reports failure rather than throwing when storage is full", () => {
    expect(writeCart(hostileStorage, ["a"])).toBe(false);
  });

  it("reports success on a normal write", () => {
    expect(writeCart(fakeStorage(), ["a"])).toBe(true);
  });
});

describe("the storage key", () => {
  it("is versioned, so a future shape change cannot misread old carts", () => {
    expect(CART_STORAGE_KEY).toMatch(/\.v\d+$/);
  });
});
