# Declutter

An escrow-mediated peer-to-peer marketplace for used goods.

**The idea.** Declutter puts a verified intermediary between private buyers and sellers. Listings are
reviewed and priced by an admin, payments are held until handover, communication is mediated, and the
physical exchange is gated by a payment-proof PIN. Money never moves directly between the two parties,
and contact details unlock in stages tied to commitment.

That is the full concept. What this branch implements is the buyer's side of it, described under
Status below.

Coursework for DLBITPEWP01_E, Project: Getting Started in Web Programming, Task 2 (E-Commerce Site).

## Status

**Submission scope: the buyer's purchase journey, delivered end to end.** A visitor can browse the
marketplace, filter and sort it without a page reload, open an item, build a cart that survives
navigation, pay a simulated 10% deposit, land on a confirmation page backed by a real order row,
and return to those orders later. Every figure shown is recalculated on the server.

205 tests pass against a real PostgreSQL database, and a clean clone runs with no API keys and no
accounts.

### What is deliberately not here

Accounts and sign-in, seller submission, admin curation and pricing, the anonymised message relay,
the post-deposit direct thread and the meetup map are **not on this branch**. Phase 1 supervisor
feedback described exactly this reduced scope as the fallback if the wider build proved difficult,
and the choice here was to deliver it properly rather than deliver more of it thinly.

That work does exist: it is built, tested and merged on the **`full-scope`** branch, which carries
the same project through the escrow flow, the relay and the meetup map. It is not claimed as part
of this submission.

### Pages

| Route | What it does |
|---|---|
| `/` | Marketplace: responsive grid, category filter and price sort, both without a reload |
| `/items/[id]` | Item detail: gallery, condition, description, deposit and balance |
| `/items/[id]` (unavailable) | A reserved or sold item keeps its page, with the reason and what happens next |
| `/cart` | Cart: current prices, unavailable items excluded from totals, remove |
| `/checkout` | Refund terms, explicit acceptance, simulated deposit |
| `/orders/confirmation` | Order reference, deposit paid, balance outstanding, hold expiry |
| `/orders` | Every order this buyer has placed |
| `/orders/[id]` | One order in full, with the terms that were accepted |

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

**There is no sign-in on this branch**, so these accounts matter only to the seed and to the
database views. Checkout acts as `buyer1` through a single server-side function, `getActingBuyer`,
which keeps `Order.buyerId` non-nullable rather than weakening the schema for a temporary gap. On
the `full-scope` branch that one function reads the session instead, and no call site changes.

## Tests

```bash
npm test           # once
npm run test:watch # watching
npm run typecheck  # tsc --noEmit
```

Tests run against `TEST_DATABASE_URL`, a separate database that gets truncated between cases. The setup file refuses to run if it matches `DATABASE_URL`, because a mistake there would eat the development catalogue.

205 tests across 11 files. Coverage concentrates on what clicking cannot verify:

- the item state machine's legal and illegal transitions, including ones no page drives yet
- one active order per item under two simultaneous deposits, guaranteed by a partial unique index
  rather than by application code, and still passing with the application-level check removed
- checkout ignoring a tampered deposit, total or price in the request body, and never echoing it
- a cart holding one unavailable item creating no orders at all
- an order read returning nothing for a buyer it does not belong to
- an unavailable item returning its details while an id that was never issued returns nothing
- money surviving as `Decimal` rather than drifting as a float

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

### 3. Paying the deposit at checkout

**Built.** `src/app/checkout/checkout-view.tsx` calls `POST /api/checkout`, then clears the ordered items from the cart and moves to the confirmation page.

The request body is `{ itemIds, acceptedTerms: true }` and nothing more. No price, deposit or total leaves the browser; if one is added by hand it is stripped by the Zod schema and never echoed. The route handler, `src/app/api/checkout/route.ts`, answers:

- `201` with one order per item: reference, deposit paid, balance outstanding and hold expiry, all derived from stored prices
- `400` for an empty cart, unaccepted refund terms or a malformed body
- `409` listing every item that can no longer be reserved, in which case **no order at all** was created and the page re-checks the cart

Checkout runs in a single transaction and moves each item from `listed` to `on_hold` for 72 hours. Two buyers paying for the same item at the same moment get exactly one order and one `409`, guaranteed by the partial unique index rather than by application code. Payment is simulated and the page says so above the pay button.

Each of the three is an explicit `fetch` against a route handler that returns JSON. A fourth, the
message thread polling, exists on the `full-scope` branch and is not part of this submission.

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
| Styling | Tailwind CSS | Responsive marketplace grid |
| Client scripting | TypeScript and the Fetch API | The assessed AJAX work |
| Images | Local filesystem | No object storage account |
| Tests | Vitest | Route-handler and pure-module seams, against a real database |

`next-auth` is installed and unused on this branch: the sign-in it powers lives on `full-scope`.
Leaflet, used there for the meetup map, is not installed here.

Every choice is constrained by one rule: an examiner must clone this repository and run it with no API keys and no paid services.

## Simulated subsystems

Nothing here contacts a paid service. Two subsystems are deliberately faked on this branch, and
each is labelled in the interface so nobody is misled into thinking money moved.

| Subsystem | What happens instead |
|---|---|
| Payment gateway | An endpoint driving the same state transitions a real webhook would, announced as simulated above the pay button |
| Hold expiry | Evaluated on read, so there is no cron, scheduler or background worker to deploy |

Three more are faked on `full-scope`: phone verification accepts any code, payouts are an admin
"mark paid" action, and messaging is in-house on the `messages` table rather than a chat service.

## Data model

Seven tables: users, items, item images, orders, threads, messages and payouts. The whole schema
ships in the first migration, so later work extends behaviour rather than retrofitting constraints;
this branch exercises users, items, item images and orders, and leaves the last three for the
messaging and payout flows on `full-scope`.

Two decisions worth knowing, because they look unusual:

**No join table between orders and items.** Every listing is a unique single item, so quantity is meaningless and an order references exactly one item. A cart of three items produces three orders.

**The seller's payout and the public price are stored separately**, not derived from one another by a percentage. The payout figure is a promise to a person and must never be subject to rounding drift. The difference is the platform margin.

One active order per item is enforced by a partial unique index over non-terminal statuses, so two buyers depositing at the same moment cannot both succeed. That is a database guarantee, not an application check.
