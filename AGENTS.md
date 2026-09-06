# Declutter — Agent & Developer Guide

**Escrow-mediated peer-to-peer resale marketplace**
Course: DLBITPEWP01_E — Project: Getting Started in Web Programming (Task 2, E-Commerce Site)
PRD v1.2 · Phase 1 — Conception

Declutter inserts a verified, identified intermediary between private buyers and sellers of used goods. Listings are curated and re-priced by an admin, payments are held in escrow, communication is mediated, and physical handover is gated by a payment-proof PIN.

> **Nothing is implemented yet.** This repository currently holds planning documents only. The layout and conventions below are the target to build toward, not a description of existing code.

---

## Source of truth

| Document | Role |
|---|---|
| `Declutter_PRD_Project.md` | **Authoritative for anything built.** Defines submission scope. Where documents conflict, this one wins. |
| `Declutter_PRD_Product.md` | Wider product vision (real payments, hosted chat, disputes, reputation). Deferred — do not build from it. |
| `Declutter_Phase1_Concept (1).pdf` | Phase 1 concept deliverable |
| `Declutter_Phase1_ERD.pdf` | Entity-relationship diagram |

Requirement IDs (`AUTH-1`, `SELL-3`, `MSG-6`, `BUY-12`, `LOC-2`…) come from PRD §7. **Cite the requirement ID in commit messages and PR descriptions.**

---

## Tech Stack

Chosen for reproducibility: an examiner must clone and run the project with **no API keys and no paid services**. Do not introduce a dependency that breaks that.

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Pages and JSON API in one project; route handlers under `app/api/` |
| Language | TypeScript | Strict mode — no `any` in production code |
| Database | PostgreSQL | **Local instance via `DATABASE_URL`** — not a hosted service |
| ORM | Prisma | Typed queries, committed migrations, seed script |
| Authentication | NextAuth — Credentials provider only | Email/password against `User.passwordHash`. **No OAuth provider** — that would reintroduce third-party keys |
| Styling | Tailwind CSS + shadcn/ui | Responsive marketplace grid, accessible primitives |
| Client scripting | TypeScript + Fetch API | Thread polling and cart updates — the assessed AJAX work |
| Maps | Leaflet + OpenStreetMap | No API key, no billing |
| Image storage | Local filesystem (`public/uploads`) | No object-storage account |
| Cart | Client state persisted to `localStorage` | No cart table; re-validated server-side at checkout |
| Version control | Git / GitHub | Required deliverable |

**Deliberately excluded:** Supabase or any hosted database, OAuth providers, object storage, SMS providers, payment gateways, cron/background workers. Each would require a credential the examiner does not have. If a task seems to call for one, it is the wrong task — check §12.1 for the intended simulation.

---

## Roles & Permissions

Three roles. Route access is enforced **server-side on every protected route** (AUTH-6) — never in the UI alone.

| Role | Who | Key capabilities |
|---|---|---|
| `seller` | Individual listing a used item | Submit listing, track status, answer information requests, view meetup once on hold, redeem PIN, view payout status |
| `buyer` | Individual purchasing | Browse, filter, information request, cart, deposit, direct thread, agree meetup, pay balance, receive PIN |
| `admin` | Platform operator — **single account, provisioned at setup, not self-registerable** (AUTH-5) | Approval queue, reject with reason, edit listing copy, set public price, full unmasked thread visibility, relay/withhold messages, mark payout paid, view all orders |

Registration collects **email and phone only** (AUTH-1). Phone is verified before listing or depositing (AUTH-3). **No identity documents are collected or stored** — a deliberate data-minimisation decision under GDPR Art. 5(1)(c) (PRD §10.3). Do not add them.

---

## Data Model

Six tables (PRD §11). Full column lists are in the PRD; the ERD is `Declutter_Phase1_ERD.pdf`.

| Model | Purpose |
|---|---|
| `User` | id, role, email, phone, phoneVerified, passwordHash, firstName, createdAt |
| `Item` | sellerId, title, description, category, condition, **sellerPayoutAmount**, **listedPrice**, status, approvedBy |
| `ItemImage` | itemId, url, sortOrder — lowest `sortOrder` is the card thumbnail |
| `Order` | itemId, buyerId, depositAmount, balanceAmount, status, **pinHash**, pinIssuedAt, pinRedeemedAt, holdExpiresAt, meetupLat/Lng/Label |
| `Thread` | itemId, orderId, threadType, status, lockedReason, lockedAt |
| `Message` | threadId, senderId, body, **visibleTo**, createdAt |
| `Payout` | orderId, adminId, amount, status, paidAt |

Roles, statuses, `threadType` and `visibleTo` are Postgres enums declared in `schema.prisma` — invalid states are unrepresentable at the database level. Money fields are `Decimal`, never floating point, and all amounts are Nigerian Naira (₦).

**Catalogue:** general used goods across six fixed categories — Electronics, Furniture, Appliances, Fashion, Books, Other.

**Design decisions — do not "improve" these without recording why:**

- **No `order_items` join table.** Every listing is a unique single item, so an order references exactly one item. A cart of three items produces three orders.
- **`seller_payout_amount` and `listed_price` are stored separately**, not derived by percentage. The payout figure must never be subject to rounding drift. The difference is the platform margin.
- **`Message.visibleTo` powers the anonymised relay** — one messages table serves both thread types. Do not add a second messaging table.
- **Meetup coordinates live on `Order`** — one meetup per order; a separate table would be pure indirection.
- **Schema changes go through committed Prisma migrations.** The examiner must reproduce the schema with `prisma migrate deploy` followed by `prisma db seed`.

---

## Item State Machine

This state machine is the core of the project — it is why the escrow model was chosen (PRD §2). Treat transitions as the highest-risk code in the repository.

| State | Meaning | Transitions to |
|---|---|---|
| `pending_review` | Submitted, awaiting admin | `listed`, `rejected` |
| `rejected` | Admin declined, with reason | — (terminal) |
| `listed` | Public and reservable | `on_hold` |
| `on_hold` | Deposit paid, contact channel open | `sold`, `listed` (on expiry) |
| `sold` | Balance paid, PIN issued | `completed` |
| `completed` | PIN redeemed, payout due | — (terminal) |

**Rules**

- **One active order per item, ever.** Enforced by a partial unique index on `Order(itemId)` over non-terminal statuses — not by application code alone.
- **Holds expire after 72 hours**, returning the item to `listed`.
- Items in `sold` or `completed` are removed from the public marketplace.
- Any cart holding an item not in `listed` must display it as unavailable (BUY-6).

---

## Key Architecture Rules

- **Server-side price authority.** Totals are always recalculated from the database. Never accept a price, deposit, or balance figure from the client. (§10.4)
- **All database access through Prisma's typed API.** No `$queryRawUnsafe`, no string-interpolated SQL — injection resistance is explicitly assessed.
- **Validate every API boundary with Zod.** Item titles, descriptions, and message bodies are attacker-controlled. React escapes output by default; never reach for `dangerouslySetInnerHTML` on user content.
- **Role checks are server-side on every protected route.** Hiding a link is not access control.
- **PINs are single-use and bound to exactly one order.** Store only a bcrypt hash; show the plaintext to the buyer once at issue and never again. Redemption compares against the hash. A lost PIN is replaced by reissue, which invalidates the previous one. A buyer must not be able to produce a valid PIN without having paid.
- **Deposit is 10% of listed price.** Refund terms (§9) must be displayed *before* payment is taken.
- **Relay threads must never leak buyer identity to the seller** (MSG-2). Before a deposit exists, the parties cannot reach each other.
- **Direct threads open automatically when a deposit is recorded** (MSG-3).
- **Threads lock on completion or rejection** and mask counterparty names for both parties, while the admin retains full unmasked visibility (MSG-5/6/7).
- **New messages arrive without a full page reload** via Fetch polling against the API routes (MSG-8). This AJAX work is directly assessed — keep it explicit and visible rather than hiding it behind a data-fetching library.

---

## Simulated Subsystems

Five things are deliberately faked (PRD §12.1). **Do not implement the real version** — it adds no assessable web-programming content and breaks reproducibility for the examiner.

| Subsystem | What to build instead |
|---|---|
| Payment gateway | A simulated confirmation endpoint driving the same state transitions a real webhook would |
| SMS phone verification | The full flow, but any code is accepted |
| Bank payouts | An admin "mark paid" action writing a `payouts` row |
| Hold expiry job | Expiry evaluated **on read** — no cron, no scheduler dependency |
| Stream Chat | In-house messaging on the `messages` table |

---

## Out of Scope

Do not build, and do not propose building: real payment processing, hosted chat infrastructure, automated fraud or keyword detection, formal dispute resolution, ratings/reviews/reputation, video calling, push or SMS notifications, search ranking or recommendations, identity document verification. (PRD §4)

---

## Acceptance Criteria

PRD §14 lists eleven steps a single operator must complete in one session — register both parties through to recording the payout and confirming the item leaves the marketplace. **That list doubles as the finalization-phase test checklist.** Check work against it rather than inventing separate criteria.

---

## Working Agreement

Settled for this project — follow these rather than improvising:

- **Build in acceptance-criteria order.** PRD §14's eleven steps are the build order, each a vertical slice (schema + API + UI) that ends demoable. Never leave a slice half-finished to start the next.
- **Test-first, always.** Vitest. Write the failing test, implement, refactor. Concentrate coverage on the invariants that clicking cannot verify: legal state transitions, one-active-order-per-item, single-use PIN redemption, server-side price authority, and role guards returning 403.
- **One branch per slice**, named `feature/NN-slug` after its §14 step, merged into `main` with `--no-ff` so each feature reads as a unit in the history. Commit per TDD cycle.
- **Preserve visible AJAX.** The cart badge, category filter, and thread polling must stay explicit client-side `fetch` calls against route handlers. The course assesses DOM/AJAX/JSON outcomes directly, and server actions would hide them. Keep the README's "where AJAX is used" section current.
- **Deployment is local only.** No hosted database, no object storage, no OAuth provider, no cron. Anything requiring a credential the examiner lacks is out.

## Skills — When to Use Each

The skills in `.claude/skills/` were carried over from a **different project** (AdminHub — a Next.js/Prisma/Supabase portal) and most do not match this stack. Genericizing them is pending work.

| Skill | Status here |
|---|---|
| `backend-development` | **Use** — Next.js route handlers, Prisma, NextAuth and Zod all match. Ignore its SBU multi-tenancy and n8n webhook sections; Declutter has neither. |
| `frontend-design` | **Use** — Tailwind/shadcn/a11y guidance applies. Ignore the Blackcod brand tokens and Stitch mockup references; Declutter has its own visual identity to define. |
| `supabase-postgres-best-practices` | **Use** — generic Postgres guidance (indexes, enums, query design) applies despite the Supabase branding |
| `application-testing` | **Use** — Vitest suits this stack |
| `qa_test` | **Use** — stack-agnostic QA sign-off document generator |
| `git-workflow`, `execution-protocol`, `review-and-update` | **Use with care** — the loop and conventions are sound, but phase names and branch tables are AdminHub's. Declutter's phases are the three course phases (§16). |
| `supabase` | **Do not use** — the database is local Postgres. No Supabase client, Auth, Storage, or RLS. |
| `sla-tracking` | **Do not use** — Declutter's only deadline is the 72-hour hold, evaluated on read. A configurable SLA engine is far more machinery than that needs. |

**Global skills** (superpowers): `brainstorming`, `writing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`
**Document skills**: `pdf`, `docx`, `pptx`, `xlsx`

---

## Open Questions

Unresolved in the PRD (§15) — surface these rather than silently deciding:

1. Exact administrative fee retained on an honest rejection.
2. Whether buyers should be rate-limited on holds to prevent frivolous reservations.
3. Whether sellers should eventually receive buyer contact details, given the current asymmetry.
4. Whether information requests should be capped per item to limit relay workload.


---

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `SwitteeFranca2-0/declutter_ecommerce`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
