# Declutter

An escrow-mediated peer-to-peer marketplace for used goods.

Declutter puts a verified intermediary between private buyers and sellers. Listings are reviewed and priced by an admin, payments are held until handover, communication is mediated, and the physical exchange is gated by a payment-proof PIN. Money never moves directly between the two parties, and contact details unlock in stages tied to commitment.

Coursework for DLBITPEWP01_E, Project: Getting Started in Web Programming, Task 2 (E-Commerce Site).

## Status

Stage A, slice 02 of 6. The application runs against a seeded PostgreSQL database and renders real listings. The catalogue grid, item detail, cart and checkout arrive in slices 03 to 06.

## Requirements

- Node.js 20 or newer
- Docker, or any local PostgreSQL 17

No API keys, no hosted services, no accounts. Everything runs locally.

## Setup

```bash
npm install
cp .env.example .env

# Start PostgreSQL. Skip this if you already have one running locally and have
# pointed DATABASE_URL at it instead.
docker compose up -d

npm run db:migrate     # apply the schema
npm run db:seed        # load 15 listings across six categories
npm run dev
```

Open http://localhost:3000.

If you prefer your own PostgreSQL to the container, create two databases, `declutter` and `declutter_test`, and edit `DATABASE_URL` and `TEST_DATABASE_URL` in `.env`. Nothing else changes.

## Demo accounts

Every seeded account uses the password **`declutter`**.

| Role | Email |
|---|---|
| Admin | `admin@declutter.test` |
| Seller | `seller1@declutter.test` |
| Seller | `seller2@declutter.test` |
| Buyer | `buyer1@declutter.test` |
| Buyer | `buyer2@declutter.test` |

Sign-in arrives in Stage B. Until then, checkout acts as `buyer1` through a single server-side function, so the schema never needs a nullable buyer.

## Tests

```bash
npm test           # once
npm run test:watch # watching
npm run typecheck  # tsc --noEmit
```

Tests run against `TEST_DATABASE_URL`, a separate database that gets truncated between cases. The setup file refuses to run if it matches `DATABASE_URL`, because a mistake there would eat the development catalogue.

Coverage concentrates on what clicking cannot verify: the item state machine's legal and illegal transitions, one-active-order-per-item under concurrent deposits, and that money survives as `Decimal` rather than drifting as a float.

## Where AJAX is used

The course assesses client-side scripting outcomes (DOM, AJAX, JSON) directly, so these are explicit `fetch` calls against JSON route handlers rather than server actions, which would hide the exchange.

| Interaction | Where | Status |
|---|---|---|
| Category filter re-renders the catalogue grid with no page reload | catalogue page against `GET /api/items` | slice 03 |
| Cart badge count updates in place when an item is added | header against `GET /api/cart/summary` | slice 05 |
| New messages appear in a thread without a reload, by polling | thread view | Stage C |

This section is updated in the same slice that adds each interaction.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest, once |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply committed migrations |
| `npm run db:seed` | Load demo users and listings |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio, a database browser |

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js, App Router | Pages and JSON API in one project |
| Language | TypeScript, strict | No `any` in production code |
| Database | PostgreSQL, local | No hosted service, no credential an examiner lacks |
| ORM | Prisma | Typed queries, committed migrations, seed script |
| Auth | NextAuth, credentials only | No OAuth provider, so no third-party keys |
| Styling | Tailwind CSS | Responsive marketplace grid |
| Client scripting | TypeScript and the Fetch API | The assessed AJAX work |
| Maps | Leaflet with OpenStreetMap | No API key, no billing |
| Images | Local filesystem | No object storage account |
| Tests | Vitest | |

Every choice is constrained by one rule: an examiner must clone this repository and run it with no API keys and no paid services.

## Simulated subsystems

Five things are deliberately faked, and each is labelled as such in the interface so nobody is misled into thinking money moved.

| Subsystem | What happens instead |
|---|---|
| Payment gateway | A confirmation endpoint driving the same state transitions a real webhook would |
| Phone verification | The full flow, accepting any code |
| Bank payouts | An admin "mark paid" action writing a payout record |
| Hold expiry | Evaluated on read, so there is no cron or scheduler dependency |
| Chat infrastructure | In-house messaging on the messages table |

## Data model

Six tables: users, items, item images, orders, threads, messages, payouts.

Two decisions worth knowing, because they look unusual:

**No join table between orders and items.** Every listing is a unique single item, so quantity is meaningless and an order references exactly one item. A cart of three items produces three orders.

**The seller's payout and the public price are stored separately**, not derived from one another by a percentage. The payout figure is a promise to a person and must never be subject to rounding drift. The difference is the platform margin.

One active order per item is enforced by a partial unique index over non-terminal statuses, so two buyers depositing at the same moment cannot both succeed. That is a database guarantee, not an application check.
