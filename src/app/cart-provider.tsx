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
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  addItem,
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
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Cart>(EMPTY_CART);
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const inFlight = useRef<AbortController | null>(null);

  // Read storage after mount. Reading during render would make the server and
  // client markup disagree and produce a hydration mismatch.
  useEffect(() => {
    const storage = browserStorage();
    setIds(storage ? readCart(storage) : EMPTY_CART);
    setReady(true);
  }, []);

  const refresh = useCallback(async (nextIds: Cart) => {
    inFlight.current?.abort();

    if (nextIds.length === 0) {
      setSummary({
        lines: [],
        availableCount: 0,
        unavailableCount: 0,
        priceTotal: "0",
        depositTotal: "0",
        balanceTotal: "0",
      });
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds: nextIds }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Request failed with ${response.status}`);

      setSummary((await response.json()) as CartSummary);
    } catch (cause) {
      // An abort is a newer request superseding this one, not a failure.
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Could not check your cart. Prices and availability may be out of date.");
    } finally {
      if (inFlight.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refresh(ids);
  }, [ids, ready, refresh]);

  /** Update storage and state together, so they can never disagree. */
  const commit = useCallback((next: Cart) => {
    const storage = browserStorage();
    // A failed write is not worth interrupting the buyer over: the cart still
    // works for this page load, it just will not survive a reload.
    if (storage) writeCart(storage, next);
    setIds(next);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      ids,
      summary,
      loading,
      error,
      ready,
      add: (id: string) => commit(addItem(ids, id)),
      remove: (id: string) => commit(removeItem(ids, id)),
      clear: (gone: readonly string[]) => commit(removeItems(ids, gone)),
      contains: (id: string) => hasItem(ids, id),
      // Before the first response, fall back to the raw count so the badge is
      // never wrong by omission.
      count: summary ? summary.availableCount + summary.unavailableCount : countItems(ids),
    }),
    [ids, summary, loading, error, ready, commit],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside a CartProvider");
  return context;
}
