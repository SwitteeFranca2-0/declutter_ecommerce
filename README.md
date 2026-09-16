# Declutter

An escrow-mediated peer-to-peer marketplace for used goods.

Declutter puts a verified intermediary between private buyers and sellers. Listings are reviewed and priced by an admin, payments are held until handover, communication is mediated, and the physical exchange is gated by a payment-proof PIN. Money never moves directly between the two parties, and contact details unlock in stages tied to commitment.

Coursework for DLBITPEWP01_E, Project: Getting Started in Web Programming, Task 2 (E-Commerce Site).

## Status

Stage A, slices 02 to 05 of 6. The marketplace grid, category filter, price sort, item detail page and cart all work against a seeded PostgreSQL database. Checkout arrives in slice 06.

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

### 1. Category filter and sort on the marketplace

**Built.** `src/app/catalogue.tsx` calls `GET /api/items` and replaces the grid in place.

Choosing a category chip or changing the sort builds a query string, calls `fetch("/api/items?category=books&sort=price_asc")`, parses the JSON response and sets React state, which re-renders the grid. No page reload and no form submission.

The route handler is `src/app/api/items/route.ts`. It validates the query with Zod before touching the database, returns `400` with field-level detail on anything unrecognised, and applies `status: "listed"` unconditionally so no query string can widen the result past what is publicly visible.

Details worth noting in the code:

- The first render uses items fetched on the **server**, so the page is complete before any JavaScript runs and the catalogue works with JavaScript disabled. The filter is an enhancement, not a requirement.
- In-flight requests are aborted with `AbortController` when the filter changes again, so a slow response for an old filter cannot overwrite a newer one.
- The item count is in an `aria-live="polite"` region, so a screen reader hears the grid change.
- Failures show a message and a retry, rather than an empty grid that looks like a category with no items.

### 2. Cart, and the header badge

**Built.** `src/app/cart-provider.tsx` calls `POST /api/cart` and both the header badge and the cart page re-render from the response.

The cart itself holds **item identifiers only**, in `localStorage`, so it survives navigation and closing the tab. It never stores a price. Whenever it changes, the identifiers are posted to `/api/cart`, which returns current prices, per-item availability and the totals. Adding an item updates the badge in place, with no reload.

Storing identifiers rather than prices is a security decision, not a storage one. A price in `localStorage` is a price the buyer can edit, and it would go stale the moment an admin re-prices an item. Every figure shown comes back from the server.

That round trip is also what powers **BUY-6**: an item reserved or sold by someone else while the buyer was browsing comes back marked unavailable, is struck through, excluded from every total, and cannot be checked out. It stays visible so the buyer can see what happened and remove it.

The cart logic is a pure module in `src/lib/cart.ts` with no React and no `window`, so it is tested directly without a DOM, including malformed JSON, unknown identifiers and storage that throws.

### 3. Thread polling

**Stage C.** New messages appear in a thread by polling a JSON route handler.

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
