/**
 * The item state machine.
 *
 * This is the core of the project and the highest-risk code in the repository.
 * It is a pure function with no database access so it can be tested directly
 * and read as documentation. Any transition not in the table is rejected.
 *
 * PRD §8. See also `docs/adr/0001-phase2-build-order.md`: the whole machine
 * ships in the first migration even though Stage A drives only part of it.
 */

export const ITEM_STATUSES = [
  "pending_review",
  "rejected",
  "listed",
  "on_hold",
  "sold",
  "completed",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Why a transition is being attempted. Each trigger has exactly one legal move. */
export type ItemTrigger =
  | "admin_approves"
  | "admin_rejects"
  | "deposit_recorded"
  | "balance_recorded"
  | "hold_expired"
  | "pin_redeemed";

type Transition = {
  from: ItemStatus;
  to: ItemStatus;
  trigger: ItemTrigger;
};

/** The authoritative transition table. Nothing outside this list is legal. */
export const TRANSITIONS: readonly Transition[] = [
  { from: "pending_review", to: "listed", trigger: "admin_approves" },
  { from: "pending_review", to: "rejected", trigger: "admin_rejects" },
  { from: "listed", to: "on_hold", trigger: "deposit_recorded" },
  { from: "on_hold", to: "sold", trigger: "balance_recorded" },
  { from: "on_hold", to: "listed", trigger: "hold_expired" },
  { from: "sold", to: "completed", trigger: "pin_redeemed" },
] as const;

/** No transition leaves these. */
export const TERMINAL_STATUSES: readonly ItemStatus[] = ["rejected", "completed"];

/** Items in these statuses are removed from the public marketplace. */
export const OFF_MARKET_STATUSES: readonly ItemStatus[] = [
  "pending_review",
  "rejected",
  "on_hold",
  "sold",
  "completed",
];

export function isTerminal(status: ItemStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Whether an item in this status may be shown in the public catalogue. */
export function isPubliclyVisible(status: ItemStatus): boolean {
  return status === "listed";
}

export type TransitionResult =
  | { ok: true; to: ItemStatus }
  | { ok: false; reason: string };

/**
 * Apply a trigger to a status.
 *
 * Returns the resulting status, or an explanation. Never throws: callers turn
 * a refusal into a 409, and a thrown error would read as a 500 instead.
 */
export function applyTrigger(
  from: ItemStatus,
  trigger: ItemTrigger,
): TransitionResult {
  const match = TRANSITIONS.find(
    (t) => t.from === from && t.trigger === trigger,
  );

  if (match) return { ok: true, to: match.to };

  if (isTerminal(from)) {
    return { ok: false, reason: `'${from}' is terminal; no transition applies` };
  }

  return { ok: false, reason: `'${trigger}' is not legal from '${from}'` };
}

/** Whether a direct move between two statuses is legal, by any trigger. */
export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/** Every status reachable from this one in a single step. */
export function nextStatuses(from: ItemStatus): ItemStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

/** Holds last 72 hours, after which the item returns to the marketplace. */
export const HOLD_DURATION_HOURS = 72;

/** The deposit is 10% of the listed price. PRD §9. */
export const DEPOSIT_RATE = 0.1;

export function holdExpiryFrom(start: Date): Date {
  return new Date(start.getTime() + HOLD_DURATION_HOURS * 60 * 60 * 1000);
}

/** Whether a hold placed at this expiry has lapsed. Evaluated on read. */
export function hasHoldLapsed(holdExpiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= holdExpiresAt.getTime();
}
