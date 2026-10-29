# Course Checklist — DLBITPEWP01_E Task 2 (E-Commerce Site)

Every item a grader can withhold marks for, in one place. Derived from the Task Portfolio brief (§1.2, §3, §4) and PRD §14.

**How to tick an item.** Only when the Definition of Done in the `declutter-development-process` skill has actually passed — tests green, feature exercised by hand in the running app, README current. Change `- [ ]` to `- [x]` and append the date and the evidence:

```
    - [x] **F-CART** - Cart: view contents, remove items, ...  _(2026-09-20, slice 03, PR #12)_
```

The evidence is not decoration. In three months it is what tells you whether a tick was real, when you are writing the abstract against it.

**Untick anything that regresses**, the moment you notice. An honest checklist showing a regression is worth more than a clean one that lies — this is the document the submission is assembled against.

> **Which branch this describes.** This checklist is kept against **`main`**, the submission branch, which
> carries slices 01 to 06: the brief's four minimum features plus the simulated deposit. Work on accounts,
> seller submission, admin curation, the relay, the direct thread and the meetup map exists on the
> **`full-scope`** branch and is deliberately not claimed here. An item unticked for that reason says so.

---

## A. Minimum required features (brief §1.2.1)

The brief names four as the floor: "at minimum, you should have a product listing page, a product detail view, a cart, and a checkout/order confirmation page." Missing any one of these is a scope failure regardless of what else is built.

- [x] **F-LIST** — Product listing page: catalogue of items from the database, responsive grid, image + title + price per card  _(2026-09-16 — slice 03: responsive grid, cards with thumbnail, title, condition, price and server-computed deposit)_
- [x] **F-DETAIL** — Product detail view: full description, condition, images, price, add-to-cart action  _(2026-09-16 — slice 04: gallery, description, condition, price, server-computed deposit and balance. Add-to-cart action is placed but wired in slice 05.)_
- [x] **F-CART** — Cart: view contents, remove items, see subtotal/total, persists across page navigation  _(2026-09-16 — slice 05: localStorage cart holding ids only, header badge via POST /api/cart, current prices, unavailable items excluded from totals, empty and corrupted states)_
- [x] **F-CHECKOUT** — Checkout / order confirmation: places an order, writes an `Order` row, shows a confirmation with an order reference  _(2026-09-26 — verification pass over slices 06 to 09: deposit paid on a ₦9,500 item wrote order `DCL-ZV7AR93R`; the confirmation page rendered the reference, ₦9,500 price, ₦950 deposit, ₦8,550 balance, the hold expiry and the 'Simulated payment: no money moved' label. The same link showed 'No order to show' to another buyer and signed out.)_
- [x] **F-BACKNAV** — Navigation works both ways: listing → detail → back to catalogue, and a persistent header with a cart indicator  _(2026-09-16 — slice 05: listing → detail → back preserving the filter, plus a persistent header with the cart indicator on every page)_

## B. Assessed technical outcomes (brief §1.2.2)

- [x] **T-AJAX** — At least one asynchronous interaction: explicit client-side `fetch` against a JSON route handler, updating the DOM without a page reload  _(2026-09-16 — slice 03: category filter and sort call GET /api/items with fetch and re-render the grid in place)_
- [x] **T-AJAX-DOC** — Where AJAX/JSON is used is documented in the README and in code comments (the brief asks for this explicitly)  _(2026-09-16 — slice 03: README 'where AJAX is used' section written, naming the interaction and the route handler)_
- [x] **T-DB** — Integrated database with sample data loaded, reachable from the running app  _(2026-09-13 — slice 02: PostgreSQL 17 in Docker, 15 seeded items reaching a rendered page)_
- [x] **T-ORDER-RECORD** — Placing an order writes a durable record; verifiable in the database, not just on screen  _(2026-09-26 — verification pass over slices 06 to 09: read back with psql, not from the page — `depositAmount 950.00`, `balanceAmount 8550.00`, `status deposit_paid`, item `on_hold`, `buyerId` the registering buyer.)_
- [x] **T-SERVER-PRICE** — Prices and totals are computed server-side from stored values; a tampered client payload cannot change what is charged  _(2026-09-26 — verification pass over slices 06 to 09: checkout posted with `depositAmount: "1"`, `balanceAmount: "0"`, `total: "1"`; the stored order was ₦950 / ₦8,550, derived from the listed price. Admin pricing is guarded the same way: a `sellerPayoutAmount` in the body is ignored and the margin is checked against the stored column.)_
- [x] **T-EDGE** — Edge cases handled gracefully rather than crashing: empty cart at checkout, adding the same item twice, an item that became unavailable, a detail page for a non-existent item  _(2026-09-26 — verification pass over slices 06 to 09: empty cart → 400 with a message; same item three times → one line and no doubled total, after the fix in `fix/cart-dedupe-boundary`; an item held by another buyer → 409 naming it, nothing charged; `/items/does-not-exist` → 404; refund terms unaccepted → 400. The empty-cart *page* copy renders only after localStorage is read, so it is covered by the cart unit tests and folded into the outstanding T-RESPONSIVE browser pass.)_
- [x] **T-XSS** — User-generated content is escaped; script tags in a title, description or message body render as text  _(2026-09-26 — verified on `main` for the content it renders: item titles and descriptions, seeded with hostile strings, render as text. Message bodies and registrant names are not on `main`.)_
- [x] **T-RESPONSIVE** — Layout works on a phone viewport as well as a laptop  _(2026-10-29, slice 16, #29: every buyer page walked at 390px and 1280px in Chrome, from catalogue through a paid checkout to a lapsed order and a missing item. No page wider than its viewport at either width. Orders link now reachable on a phone)_

## C. Repository and reproducibility (brief §1.2.1, §1.2.3)

- [x] **R-SKELETON** — Project skeleton committed: clear frontend/backend/asset structure, not a README-only repo  _(2026-09-13 — slice 02: Next.js App Router, TypeScript strict, Tailwind, Prisma, Vitest all committed and running)_
- [x] **R-README** — README covers what the project is, how to run it, required environment variables, and how to load sample data  _(2026-09-13 — slice 02: setup, demo credentials, sample data and the AJAX section written. 2026-10-29, slice 15: Docker one-command route first, npm route second, and how to reset to the seeded catalogue)_
- [x] **R-SETUP** — A clean clone runs end to end with no accounts, API keys or paid services: install → migrate → seed → start  _(2026-09-13 — slice 02: verified in a fresh git clone, not just the working copy: install, migrate, seed, dev, 15 items rendering, 65 tests passing. 2026-10-29, slice 15, #27: verified from a fresh clone on a fresh volume through `docker compose up --build`: migrated, seeded 15 items, two orders placed over HTTP, orders kept and no reseed after a restart. The same clean database exposed an unmigrated test database (107 of 205 failing); fixed, and 205 of 205 pass on fresh and existing databases)_
- [x] **R-CREDENTIALS** — Demo credentials for each role documented in the README  _(2026-09-13 — slice 02: five seeded accounts documented with the shared demo password)_
- [ ] **R-COMMITS** — Commit history reads as incremental milestones, not one bulk upload
- [x] **R-NO-SECRETS** — No credentials committed; `.env.example` present with placeholders  _(2026-09-13 — slice 02: .env.example committed with placeholders, .env gitignored)_
- [x] **R-CLEAN** — No leftover debug output, commented-out blocks or test data in the final codebase  _(2026-10-29, slice 17, #31: ESLint clean across the application; no console output, TODOs or commented-out code in `src/`; unused exports, the unused `next-auth` dependency and seven unreferenced seed images removed; repeated markup in cart, checkout and order pages extracted; CheckoutView split. 207 tests pass and 18 scripted cart behaviours pass in Chrome)_

## D. Acceptance criteria (PRD §14)

The eleven-step operator walkthrough. Also the finalization-phase manual test checklist.

- [ ] **AC-1** — Register a seller and a buyer, and verify both phone numbers  _(unticked 2026-09-26: built in slice 07, which is not on `main`. Lives on `full-scope`)_
- [ ] **AC-2** — Submit an item as the seller  _(unticked 2026-09-26: built in slice 08, which is not on `main`. Lives on `full-scope`)_
- [ ] **AC-3** — Approve it as admin, apply a margin, and publish it  _(unticked 2026-09-26: built in slice 09, which is not on `main`. Lives on `full-scope`)_
- [ ] **AC-4** — Submit an information request as the buyer and answer it as the seller, neither learning the other's identity  _(unticked 2026-09-26: built in slice 10, which is not on `main`. Lives on `full-scope`)_
- [x] **AC-5** — Add the item to a cart and pay a deposit, moving it to `on_hold`  _(2026-09-26 — slice 06 on `main`: the cart, the simulated deposit and the `listed` to `on_hold` transition all work, and the order row is verifiable in the database. Caveat recorded honestly: authentication is not on `main`, so checkout acts as the seeded demo buyer through `getActingBuyer`.)_
- [ ] **AC-6** — Confirm the seller's contact details become visible and a direct thread opens  _(unticked 2026-09-26: built in slice 11, which is not on `main`. Lives on `full-scope`)_
- [ ] **AC-7** — Agree a meetup point on the map  _(unticked 2026-09-26: built in slice 12, which is not on `main`. Lives on `full-scope`)_
- [ ] **AC-8** — Pay the balance and receive a PIN
- [ ] **AC-9** — Redeem the PIN as the seller and observe the thread lock and names mask
- [ ] **AC-10** — Record the payout as admin
- [ ] **AC-11** — Confirm the item no longer appears on the marketplace and shows unavailable in any other cart

## E. Phase 2 deliverable — presentation, max 10 slides (brief §1.2.2, §4.1)

- [ ] **P2-TITLE** — Title slide: project title, name, GitHub repository link
- [ ] **P2-ARCH** — 1–2 slides: system architecture and data model / page flow diagrams, with key design decisions explained
- [ ] **P2-SHOTS** — 2–3 slides of screenshots: listing page, detail page with add-to-cart, cart with totals, order confirmation or the order row in the database — with captions pointing at what matters
- [ ] **P2-STACK** — 1 slide: languages, frameworks, libraries, tools, and any deviations from the Phase 1 plan
- [ ] **P2-CHALLENGES** — 1 slide: technical challenges and how they were solved, including any features dropped or changed
- [ ] **P2-STATUS** — 1 slide: what works, what does not, what comes next
- [x] **P2-WIREFRAMES** — UI wireframes and the buyer page flow, annotated with the data passed between steps and how the cart is stored (explicitly requested in Phase 1 feedback)  _(2026-09-12 — slice 01: design canvas, five pages at two widths, plus the annotated flow diagram. 2026-10-29: published to the repository under `docs/wireframes/` after the Phase 2 tutor found them missing, having been excluded by `.gitignore`. Redrawn from the built pages as six wireframes at two widths, each beside a screenshot of the page as built)_
- [ ] **P2-FILENAME** — Exported as PDF named `Uvere-Franca_92134098_WebProgramming_P2_S`
- [x] **P2-SUBMITTED** — Uploaded via the submission portal  _(2026-10-29: tutor feedback received, proceed to Phase 3 without resubmission. See `docs/phase2-feedback.md`)_

## F. Phase 3 deliverable — finalization (brief §1.2.3, §4.1, §4.3)

- [ ] **P3-ABSTRACT** — 2-page abstract: goal, process, tools, outcomes, key learnings, changes from the original plan, plus a summarising diagram
- [ ] **P3-FORMAT** — Abstract formatted to §4.3: A4, 2 cm margins all round, Arial 11 pt body / 12 pt headings, 1.5 line spacing, justified with hyphenation, 6 pt after paragraphs
- [ ] **P3-ZIP** — Final code ZIP: full project folder, clear structure, setup files and docs included, secrets replaced with placeholders
- [ ] **P3-GITHUBLINK** — `GitHubLink.txt` containing the direct repository URL, access permissions checked
- [ ] **P3-ARTIFACTS** — Phase 1 concept document and Phase 2 presentation attached to the final submission
- [ ] **P3-FILENAME** — Files named `Uvere-Franca_92134098_WebProgramming_P3_S`
- [ ] **P3-AFFIDAVIT** — Affidavit of independent work signed electronically on myCampus (no submission is possible before this)
- [ ] **P3-SUBMITTED** — Uploaded via the submission portal

## G. Reflection journal (brief §1.2.2)

The brief asks for a running journal of deviations and challenges, kept *during* development, because Phase 2's challenges slide and Phase 3's abstract are both written from it. Reconstructing it at the end is where marks quietly go missing.

- [ ] **J-STARTED** — `docs/reflection-journal.md` exists and has entries from more than one slice
- [ ] **J-DEVIATIONS** — Every deviation from the Phase 1 plan is recorded with its reason
- [ ] **J-CHALLENGES** — Technical challenges recorded with the resolution, not just the symptom
- [ ] **J-LEARNINGS** — Personal learnings recorded as they happen

---

## Evaluation weighting (brief §3)

Context for where effort pays. Not ticked.

| Criterion | Weight | What it rewards here |
|---|---|---|
| Quality of Implementation | 40% | Sections A, B, C — working, reproducible, tested, documented |
| Methodology/Ideas/Procedure | 20% | Sound and justified architecture, clearly communicated |
| Creativity/Correctness | 20% | The escrow model as the distinctive touch, and features that actually work correctly |
| Problem-Solving Techniques | 10% | Clear problem definition and scoping — largely banked in Phase 1 |
| Formal Requirements | 10% | Sections E and F — file naming, formats, lengths, affidavit |

Implementation is 40%. A working, reproducible, well-documented core journey outscores an ambitious half-finished one — which is exactly what the Phase 1 feedback said.
