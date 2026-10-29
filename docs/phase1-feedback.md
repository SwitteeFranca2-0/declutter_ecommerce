# Phase 1 Supervisor Feedback

**Received:** 2026-09-12 · **Verdict:** conditional go-ahead to Phase 2

## Summary

Paraphrased rather than quoted — the wording is the supervisor's and this repository is public.

The submission received a **conditional go-ahead to Phase 2**. Domain, stack (Next.js/React/TypeScript, Prisma, PostgreSQL), architecture, ERD and the security approach (server-side prices, bcrypt, role guards) were all assessed as strong and well documented.

The condition is scope discipline. The escrow deposit flow, anonymised messaging, PIN handover, meetup maps and full admin curation were judged to sit beyond what the course prototype requires — though the submission was also encouraged to attempt them. If difficulty arises, the advice is to fall back to a reduced MVP: catalogue → detail → cart → simulated checkout → order confirmation.

Three specific requests:

1. Add UI wireframes and a simple buyer page flow (browse → detail → cart → checkout → confirmation), stating what data passes between steps and how the cart is stored.
2. The Git and README requirement is met, but the repository is README-only; add a basic project skeleton early in Phase 2.
3. Keep the security approach — server-side totals, simulated payment.

The closing instruction: deliver a working end-to-end purchase journey first, and treat escrow, PIN and maps as optional later extensions.

## Passed — do not churn these

Domain model, stack choices, architecture, ERD, and the security approach (server-side totals, bcrypt, role guards, simulated payment) were all assessed as strong. Changes to any of these now cost marks rather than earning them. Treat them as frozen unless implementation forces a change, and record the reason in an ADR if it does.

## Required actions

| # | Action | Status |
|---|---|---|
| 1 | UI wireframes + buyer page flow (browse → detail → cart → checkout → confirmation), annotated with the data passed between steps and how the cart is stored | Done in slice 01. Published to the repository and redrawn from the built pages on 2026-10-29 ([`wireframes/`](wireframes/)) |
| 2 | Basic project skeleton committed early in Phase 2 — Next.js app, Prisma schema, first migration, seed script | Done in slice 02, 2026-09-13 |
| 3 | Build order front-loading the end-to-end purchase journey | Resolved by [ADR-0001](adr/0001-phase2-build-order.md) |

Action 1 is the only genuine gap in the Phase 1 submission. The PRD answers it in prose (§11, cart in `localStorage`, re-validated server-side at checkout) but carries no diagram, and the diagram is what is being marked.

## Reading the mixed signal on escrow

The feedback places escrow, anonymised messaging, PIN handover, meetup maps and admin curation beyond what the course prototype needs, encourages attempting them anyway, and then calls them optional later extensions — three positions in as many sentences.

**Interpretation adopted:** this is guidance on *sequencing*, not a *scope cut*. The concern is ending the course with no demoable purchase journey. PRD §13 still commits to these features as built-fully and that commitment stands — they are built after the purchase spine works end to end, not instead of it. If time runs short, they are the first things to drop, in that order, and §13 is amended to match.

## Open with the supervisor

Nothing blocking. If time pressure appears mid-phase, confirm before dropping any §13 "built fully" feature, since §13 is a written commitment in the Phase 1 submission.
