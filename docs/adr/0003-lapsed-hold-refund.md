# ADR-0003: On the submission branch, a lapsed hold refunds the whole deposit

**Status:** Accepted · **Date:** 2026-10-29
**Context docs:** PRD §9, PRD §15, [Phase 2 feedback](../phase2-feedback.md)

## Context

PRD §9 sets the deposit and refund policy. Two of its rows decide what happens when a hold runs out:

| Event | Outcome |
|---|---|
| Buyer abandons (never attends) | 50% of deposit forfeited, 50% refunded |
| Hold expires without contact | Treated as abandonment |

That rule assumes the buyer had a way to make contact and chose not to. In the full concept they do: a deposit opens a direct thread with the seller and a meetup is agreed on a map, so a hold that lapses without contact is a buyer who walked away.

The submission branch is the reduced buyer journey the Phase 2 tutor accepted. It has no messaging, no meetup and no balance payment. Once a deposit is paid there is nothing the buyer can do, so **every hold on this branch lapses**, and none of them through any choice of the buyer's.

Three places disagreed about what follows. The refund terms shown at checkout said half the deposit is kept, following PRD §9. The orders page still read "₦X paid, ₦Y on collection" on a lapsed order, implying nothing had changed. The Phase 2 deck said the deposit was refunded.

## Decision

On the submission branch a lapsed hold refunds the whole deposit, and nothing remains to pay.

- The refund terms shown before payment say so, and the confirmation and order pages repeat them from the same source (`src/lib/refund-policy.ts`).
- The order read model computes what is refunded and what is still due on the server (`refundAmount`, `balanceDue` in `src/lib/orders.ts`). Pages display those figures and never decide the rule themselves.

**PRD §9 is not amended.** In the full concept, where contact exists, a lapsed hold can be told apart from a buyer who was never given the chance, and treating it as abandonment remains the policy.

## Alternatives considered

**Keep PRD §9 as written.** Consistent with the spec, and wrong for this build: it keeps half the deposit from every buyer for failing to take a step the application does not offer. A policy that penalises the only possible outcome is not a policy about behaviour.

**Amend PRD §9 for the product as a whole.** Removes the cost of reserving an item and never turning up, which is exactly the frivolous-hold problem PRD §15 lists as open question 2. The reason for refunding here is specific to the reduced scope, so the change stays scoped to it.

## Consequences

- The terms a buyer accepts at checkout differ from PRD §9 in one row. The abstract names this as a scope-driven deviation.
- When the full concept is built on this branch, this ADR is superseded and the expiry row returns to PRD §9's rule.
- Nothing is stored about a refund. Payment is simulated (PRD §12.1), so the refund is a figure derived from the order's status, not a transaction.
