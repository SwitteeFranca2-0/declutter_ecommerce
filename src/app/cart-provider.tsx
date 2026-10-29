"use client";

/**
 * Cart state for the whole application.
 *
 * ── ASSESSED AJAX ─────────────────────────────────────────────────────────
 * Whenever the cart changes, this posts the identifiers to `POST /api/cart`
 * with `fetch` and receives current prices, availability and totals. The
 * header badge and the cart page both re-render from that response, with no
 * page reload.
 *
 * The identifiers live in `localStorage` so the cart survives navigation and
 * closing the tab. Everything else, every price and every total, comes from
 * the server, so a stale or tampered localStorage entry cannot change what a
 * buyer is shown or charged.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * The cart logic itself is in `src/lib/cart.ts`, kept pure and free of React so
 * it can be tested without a DOM. This file is only the plumbing.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

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
  type Cart,
} from "@/lib/cart";
import type { CartSummary } from "@/lib/cart-summary";

type CartContextValue = {
  /** Identifiers, straight from storage. Available immediately. */
  ids: Cart;
  /** Resolved against the database. Null until the first response arrives. */
  summary: CartSummary | null;
  /** True while a request is in flight. */
  loading: boolean;
  /** Set when the last request failed. */
  error: string | null;
  /** True once storage has been read, so the UI does not flash an empty cart. */
  ready: boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  clear: (ids: readonly string[]) => void;
  contains: (id: string) => boolean;
  /** Re-check prices and availability without changing the cart, e.g. after a checkout conflict. */
  revalidate: () => void;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_SUMMARY: CartSummary = {
  lines: [],
  availableCount: 0,
  unavailableCount: 0,
  priceTotal: "0",
  depositTotal: "0",
  balanceTotal: "0",
};

/** Browser storage, or null during server rendering. */
function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Blocked site data. The cart still works for this page load.
    return null;
  }
}

// ── The cart identifiers as an external store ────────────────────────────────
// localStorage is outside React, so React reads it through
// useSyncExternalStore rather than copying it into state after mount. The
// server renders an empty cart and the browser swaps in the stored one during
// hydration, with no mismatch and no flash.

/** Null until first read in the browser. Also the fallback when storage is blocked. */
let current: Cart | null = null;
const listeners = new Set<() => void>();

function getCart(): Cart {
  if (current === null) {
    const storage = browserStorage();
    current = storage ? readCart(storage) : EMPTY_CART;
  }
  return current;
}

function setCart(next: Cart) {
  current = next;
  const storage = browserStorage();
  // A failed write is not worth interrupting the buyer over: the cart still
  // works for this page load, it just will not survive a reload.
  if (storage) writeCart(storage, next);
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  // Another tab changed the cart: re-read it here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CART_STORAGE_KEY) return;
    current = null;
    notify();
  };
  listeners.add(notify);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

const serverCart = () => EMPTY_CART;
const noSubscription = () => () => {};

/** The last response, and which cart it answered. */
type Resolved = { key: string; summary: CartSummary | null; error: string | null };

export function CartProvider({ children }: { children: ReactNode }) {
  const ids = useSyncExternalStore(subscribe, getCart, serverCart);
  // False while server rendering and hydrating, true once in the browser.
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);

  const [resolved, setResolved] = useState<Resolved | null>(null);
  // Bumped to re-check the same cart, e.g. after a checkout conflict.
  const [version, setVersion] = useState(0);

  const key = `${version}:${ids.join(",")}`;
  const empty = ids.length === 0;

  useEffect(() => {
    if (!ready || empty) return;

    // A newer cart supersedes this request: the cleanup aborts it.
    const controller = new AbortController();

    fetch("/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemIds: ids }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        return response.json() as Promise<CartSummary>;
      })
      .then((summary) => setResolved({ key, summary, error: null }))
      .catch(() => {
        if (controller.signal.aborted) return;
        // Keep the last good summary on screen, flagged as possibly stale.
        setResolved((previous) => ({
          key,
          summary: previous?.summary ?? null,
          error: "Could not check your cart. Prices and availability may be out of date.",
        }));
      });

    return () => controller.abort();
  }, [key, ids, empty, ready]);

  const upToDate = resolved?.key === key;
  const summary = empty ? EMPTY_SUMMARY : (resolved?.summary ?? null);

  const value = useMemo<CartContextValue>(
    () => ({
      ids,
      summary,
      loading: ready && !empty && !upToDate,
      error: !empty && upToDate ? (resolved?.error ?? null) : null,
      ready,
      add: (id: string) => setCart(addItem(ids, id)),
      remove: (id: string) => setCart(removeItem(ids, id)),
      clear: (gone: readonly string[]) => setCart(removeItems(ids, gone)),
      contains: (id: string) => hasItem(ids, id),
      revalidate: () => setVersion((v) => v + 1),
      // Before the first response, fall back to the raw count so the badge is
      // never wrong by omission.
      count: summary ? summary.availableCount + summary.unavailableCount : countItems(ids),
    }),
    [ids, summary, ready, empty, upToDate, resolved],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside a CartProvider");
  return context;
}
