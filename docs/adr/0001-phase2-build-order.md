# ADR-0001: Phase 2 build order front-loads the purchase journey

**Status:** Accepted · **Date:** 2026-09-12
**Context docs:** [Phase 1 supervisor feedback](../phase1-feedback.md), PRD §13, §14

## Context

`AGENTS.md` settled that PRD §14's eleven acceptance criteria are the build order, each step a vertical slice. Taken literally, §14 begins at *register → submit item → admin approve* and does not reach the catalogue until step 5. Nothing a marker can click at exists until three slices are done, and the assessed AJAX work (category filter, cart badge) lands later still.

Phase 1 feedback asks for the opposite emphasis: "Deliver a working end-to-end purchase journey first", prioritising `catalogue → detail → cart → simulated checkout → order confirmation`.

These conflict on ordering only. Both cover the same eleven criteria.

## Decision

Build the buyer purchase spine first, against seeded data, then backfill the flows that produce that data.

**Stage A — purchase spine (seeded catalogue).** The seed script inserts users and `listed` items directly, so the catalogue has stock without the seller or admin flows existing. Slices: catalogue + category filter (§14.11 partially, the AJAX filter) → item detail → cart with `localStorage` persistence and badge → simulated checkout with server-side total recalculation → order confirmation. At the end of Stage A a purchase journey is demoable end to end.

**Stage B — backfill the producers.** Auth and phone verification (§14.1), seller submission (§14.2), admin approval, margin and publish (§14.3). These replace the seed as the origin of catalogue stock; the seed stays as examiner convenience.

**Stage C — escrow and handover.** Information request relay (§14.4), deposit and `on_hold` (§14.5), direct thread (§14.6), meetup map (§14.7), balance and PIN issue (§14.8), PIN redemption with thread lock and masking (§14.9), payout (§14.10), marketplace removal and cart unavailability (§14.11).

Stage C is the drop-in-order-of-listing contingency if time runs short. Nothing in Stage A or B may be left half-finished to start Stage C.

## Consequences

- Checkout is built before the state machine is fully wired. Stage A checkout must still move the item off `listed` and write an `Order`, so Stage C extends transitions rather than retrofitting them. The state machine and the partial unique index on `Order(itemId)` ship in the first migration regardless of which transitions have UI.
- Branch naming `feature/NN-slug` now keys off the stage-ordered slice number, not the raw §14 step number. Each branch and commit still cites the §14 step and the PRD §7 requirement IDs it satisfies.
- The seed script becomes load-bearing early and must stay runnable — `prisma migrate deploy` then `prisma db seed` must produce a browsable catalogue at any commit from Stage A onward.
- §14 remains the finalization test checklist unchanged. Only the order of construction moves.

## Alternatives considered

**Literal §14 order.** Rejected — no demoable artefact for three slices, and it ignores explicit supervisor guidance.

**Cut escrow, messaging, PIN and maps from scope entirely.** Rejected — PRD §13 commits to them as built-fully, they carry the project's distinctive marks, and the feedback also says they are "strongly encouraged". Deferred to Stage C instead of dropped.
