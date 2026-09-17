/**
 * The deposit and refund policy, PRD §9, as the buyer reads it.
 *
 * Shown in full before payment (BUY-7) and repeated on the confirmation page.
 * One source so the two can never disagree.
 *
 * The administrative fee on an honest rejection is deliberately unquantified:
 * its amount is PRD §15 open question 1 and has not been decided.
 */

import { HOLD_DURATION_HOURS } from "@/lib/item-state";

export const REFUND_TERMS: readonly { event: string; outcome: string }[] = [
  {
    event: "You inspect the item and decide not to buy",
    outcome: "Deposit refunded in full, less a small administrative fee",
  },
  {
    event: "You do not attend the handover",
    outcome: "Half the deposit is kept, half is refunded",
  },
  {
    event: `The ${HOLD_DURATION_HOURS}-hour hold runs out without contact`,
    outcome: "Treated as not attending: half the deposit is kept",
  },
  {
    event: "The seller does not attend",
    outcome: "Deposit refunded in full",
  },
];
