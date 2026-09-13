/**
 * The item state machine, tested directly.
 *
 * One of only two pure seams in this project. Cheap, exhaustive, and it
 * documents the machine. Covers transitions no slice drives yet, because the
 * whole table ships in the first migration.
 */

import { describe, expect, it } from "vitest";
import {
  applyTrigger,
  canTransition,
  hasHoldLapsed,
  holdExpiryFrom,
  isPubliclyVisible,
  isTerminal,
  ITEM_STATUSES,
  nextStatuses,
  TRANSITIONS,
  type ItemStatus,
  type ItemTrigger,
} from "@/lib/item-state";

describe("legal transitions", () => {
  it.each(TRANSITIONS)("$from to $to on $trigger", ({ from, to, trigger }) => {
    expect(applyTrigger(from, trigger)).toEqual({ ok: true, to });
  });

  it("has exactly six", () => {
    expect(TRANSITIONS).toHaveLength(6);
  });
});

describe("illegal transitions", () => {
  const ALL_TRIGGERS: ItemTrigger[] = [
    "admin_approves",
    "admin_rejects",
    "deposit_recorded",
    "balance_recorded",
    "hold_expired",
    "pin_redeemed",
  ];

  // Every combination not in the table must be refused. This is the test that
  // catches a transition quietly added without being thought about.
  const illegal = ITEM_STATUSES.flatMap((from) =>
    ALL_TRIGGERS.filter(
      (trigger) => !TRANSITIONS.some((t) => t.from === from && t.trigger === trigger),
    ).map((trigger) => ({ from, trigger })),
  );

  it.each(illegal)("refuses $trigger from $from", ({ from, trigger }) => {
    const result = applyTrigger(from, trigger);
    expect(result.ok).toBe(false);
  });

  it("refuses rather than throwing, so callers can return 409", () => {
    expect(() => applyTrigger("completed", "deposit_recorded")).not.toThrow();
  });

  it("explains why", () => {
    const result = applyTrigger("sold", "deposit_recorded");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("sold");
  });
});

describe("terminal statuses", () => {
  it.each(["rejected", "completed"] as ItemStatus[])("%s is terminal", (status) => {
    expect(isTerminal(status)).toBe(true);
    expect(nextStatuses(status)).toEqual([]);
  });

  it.each(["pending_review", "listed", "on_hold", "sold"] as ItemStatus[])(
    "%s is not terminal",
    (status) => {
      expect(isTerminal(status)).toBe(false);
      expect(nextStatuses(status).length).toBeGreaterThan(0);
    },
  );
});

describe("public visibility", () => {
  it("shows only listed items", () => {
    const visible = ITEM_STATUSES.filter(isPubliclyVisible);
    expect(visible).toEqual(["listed"]);
  });

  it.each(["sold", "completed", "on_hold", "pending_review", "rejected"] as ItemStatus[])(
    "hides %s from the marketplace",
    (status) => {
      expect(isPubliclyVisible(status)).toBe(false);
    },
  );
});

describe("hold expiry", () => {
  it("expires 72 hours after the deposit", () => {
    const start = new Date("2026-09-13T10:00:00Z");
    expect(holdExpiryFrom(start).toISOString()).toBe("2026-09-16T10:00:00.000Z");
  });

  it("has not lapsed one hour before expiry", () => {
    const expiry = new Date("2026-09-16T10:00:00Z");
    expect(hasHoldLapsed(expiry, new Date("2026-09-16T09:00:00Z"))).toBe(false);
  });

  it("has lapsed at the moment of expiry", () => {
    const expiry = new Date("2026-09-16T10:00:00Z");
    expect(hasHoldLapsed(expiry, expiry)).toBe(true);
  });

  it("returns an expired hold to the marketplace", () => {
    expect(canTransition("on_hold", "listed")).toBe(true);
    expect(applyTrigger("on_hold", "hold_expired")).toEqual({ ok: true, to: "listed" });
  });
});

describe("the escrow path end to end", () => {
  it("walks submission through to completion", () => {
    let status: ItemStatus = "pending_review";
    const walk = (trigger: ItemTrigger) => {
      const result = applyTrigger(status, trigger);
      expect(result.ok).toBe(true);
      if (result.ok) status = result.to;
    };

    walk("admin_approves");
    expect(status).toBe("listed");
    walk("deposit_recorded");
    expect(status).toBe("on_hold");
    walk("balance_recorded");
    expect(status).toBe("sold");
    walk("pin_redeemed");
    expect(status).toBe("completed");
    expect(isTerminal(status)).toBe(true);
  });
});
