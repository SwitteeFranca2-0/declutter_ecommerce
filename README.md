# Declutter

An escrow-mediated peer-to-peer marketplace for used goods.

Declutter puts a verified intermediary between private buyers and sellers. Listings are reviewed and priced by an admin, payments are held until handover, communication is mediated, and the physical exchange is gated by a payment-proof PIN. Money never moves directly between the two parties, and contact details unlock in stages tied to commitment.

Coursework for DLBITPEWP01_E, Project: Getting Started in Web Programming, Task 2 (E-Commerce Site).

## Status

Stage A complete, Stage B under way. A buyer can register, sign in, verify their phone number (simulated), browse the marketplace, filter and sort it, open an item, build a cart, pay a simulated 10% deposit and land on a confirmation page backed by real order rows. A seller can offer an item with photographs and follow what happens to it. Admin approval and pricing are next, and until they exist a submitted item stays in review rather than reaching the marketplace.

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

Sign in at `/signin`. Every seeded account already has a verified phone number, so any of them can pay a deposit straight away.

Registering a new account is the other route in: `/register` asks for an email address, a phone number, a password and a first name. **No identity documents are requested or stored at any point**, which is a data minimisation decision under GDPR Art. 5(1)(c) (PRD §10.3). A new account then verifies its phone number at `/verify-phone`, where any code is accepted because there is no SMS provider. The admin account cannot be registered: it exists only because the seed script wrote it (AUTH-5).

## Tests

```bash
npm test           # once
npm run test:watch # watching
npm run typecheck  # tsc --noEmit
```

Tests run against `TEST_DATABASE_URL`, a separate database that gets truncated between cases. The setup file refuses to run if it matches `DATABASE_URL`, because a mistake there would eat the development catalogue.

Uploads in tests go to a temporary directory through `UPLOADS_DIR`, so a test run cannot litter `public/uploads`.

Coverage concentrates on what clicking cannot verify: the item state machine's legal and illegal transitions, one-active-order-per-item under concurrent deposits, checkout ignoring tampered amounts, a cart with one unavailable item creating no orders at all, passwords reaching the database only as a bcrypt hash, the admin role being unreachable through registration, role and phone-verification guards refusing with 401 and 403 before any write, a submitted item staying out of the marketplace whatever the request body claims, an upload whose bytes are not an image being refused, and that money survives as `Decimal` rather than drifting as a float.

Route handlers are called directly, with the acting user injected through an `as` option on the request helpers. That keeps every guard, role check and query under test while standing in for the session cookie a browser would carry.

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

### 4. Registration and phone verification

**Built.** `src/app/register/register-form.tsx` calls `POST /api/register`, and `src/app/verify-phone/verify-phone-form.tsx` calls `POST /api/verify-phone`.

Registration posts the form as JSON and renders the route's own field-level validation messages beside the inputs, so the rules shown are the rules the server enforces rather than a second copy that can drift. On success the browser signs the new account in and moves to verification without the password being typed twice.

Verification posts either a code, which is accepted whatever it is, or a corrected phone number. The route resolves the caller from the session and updates that user only, so no identifier in the body can point it at another account.

### 5. Offering an item

**Built.** `src/app/sell/submission-form.tsx` posts multipart form data to `POST /api/items`.

Photographs are chosen, previewed and reordered in the browser before anything is sent, and the first one becomes the card thumbnail. The submission goes up as one multipart request, and the field-level messages rendered beside the inputs are the route's own validation issues, so the rules shown are the rules enforced.

The route guards on role and phone verification before a byte is written, stores each file under a name the application generates, and decides a file's type by reading its leading bytes rather than trusting what it claims to be. If any file is refused, the ones already written are removed, so a refused submission leaves nothing behind.

### 6. Thread polling

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
| Auth | NextAuth, credentials provider with JWT cookie sessions | No OAuth provider, so no third-party keys, and no session table |
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
