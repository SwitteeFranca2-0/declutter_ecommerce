# Reflection Journal

Required by the course brief (§1.2.2): a running record of deviations from the Phase 1 plan, challenges and their resolutions, and learnings — kept *during* development. The Phase 2 "challenges and solutions" slide and the Phase 3 abstract are both written from this file.

Append during a slice, not at close-out. One honest line beats a reconstructed paragraph.

**Format** — newest last, date every entry:

```
## YYYY-MM-DD — slice NN, <slug>

**Deviation:** Phase 1 concept said X. Did Y instead, because Z.
**Challenge:** <symptom> → <cause found> → <fix>.
**Learning:** <what you now know that you did not before>.
```

Not every entry needs all three headings. Use the ones that apply.

---

## 2026-09-12 — pre-development

**Deviation:** The Phase 1 concept and `AGENTS.md` both set PRD §14's eleven acceptance criteria as the literal build order. Supervisor feedback asked for the buyer purchase journey to be delivered end to end first. Resequenced into three stages — see [ADR-0001](adr/0001-phase2-build-order.md). Scope is unchanged; only the order of construction moved.

**Learning:** Taken literally, §14 would have produced no clickable artefact until three slices were complete, with the assessed AJAX work landing later still. Acceptance criteria make a good test checklist and a poor build order — they are written in the order a *user journey* runs, not the order a system can be *assembled* in.

## 2026-09-13 — slice 02, seeded database

**Deviation:** The Phase 1 concept and the supervisor both assumed PostgreSQL installed natively via Homebrew. It is not installable on this machine: `/opt/homebrew` is owned by `itadmin` and the account in use is not in the `admin` group, so `brew install` cannot write and the suggested fix needs a `sudo` password only IT holds. Postgres now runs in Docker via a committed `docker-compose.yml`. The PRD is unaffected: it requires a local instance reached through `DATABASE_URL` and does not care how it is running. The README documents both routes.

**Challenge:** Three Homebrew attempts failed with three different errors, which made the real cause hard to see. First, transfers from `formulae.brew.sh` dropped below Homebrew's 100 bytes/sec abort threshold. Second, the same after raising the threshold. Third, DNS stopped resolving entirely. Only the fourth attempt got far enough to report the actual problem, a permissions error, because the earlier failures never reached that stage. The lesson: a sequence of different error messages usually means an unreliable path is masking a fixed underlying fault, and it is worth pushing through to a stable error before diagnosing.

**Challenge:** `next dev` overwrote `AGENTS.md` and `CLAUDE.md` with its own generated boilerplate on first start, destroying the hand-written project guide. Next.js 16 ships an `agentRules` feature that is on by default. Fixed by setting `agentRules: false` in `next.config.ts`. Recovery was possible because the file's base version was still in git history at `9094d6e` and the later edits were reconstructable. Had the file been untracked for longer, the loss would have been permanent. A file that matters and is deliberately gitignored has no safety net.

**Learning:** `tsc --noEmit` fails on a cold checkout of a Next.js 16 project because the generated `LayoutProps` global only exists after a build has written `.next/types`. Typing layout props explicitly keeps the typecheck runnable without a build first, which matters because `npm run typecheck` is part of the Definition of Done.

**Learning:** Prisma's schema language cannot express a partial unique index, so the one-active-order-per-item constraint is raw DDL appended to the generated migration. Generating with `--create-only`, editing, then applying is the workflow for anything Prisma cannot model. Verified in the database with `pg_indexes` rather than trusting that the file was applied.

## 2026-09-16 — slice 02 close-out, hosted database

**Deviation:** Development now runs against a hosted Supabase PostgreSQL instance rather than the local container. `AGENTS.md` lists "Supabase or any hosted database" under deliberately excluded, on the grounds that an examiner must clone and run the project with no API keys and no paid services. That reasoning still stands and is unchanged for the submission: `.env.example`, the README and the verified clean-clone path all point at the local Docker container, so the examiner's route is untouched. Only the personal `.env`, which is gitignored, points at Supabase.

**Challenge:** Three separate failures, each needing a different fix, none of which a plain connection URL reveals. First, `prisma migrate` hung with no error, because Supabase's transaction pooler on port 6543 cannot carry the session-level statements migrations issue; fixed with `directUrl` in the datasource pointing at port 5432. Second, the seed failed with `prepared statement "s0" already exists`, because Prisma uses prepared statements and pgBouncer in transaction mode cannot hold them across requests; fixed with `pgbouncer=true&connection_limit=1`. Third, four tests timed out and the suite went from 401ms to 95 seconds; fixed by pointing `TEST_DATABASE_URL` back at the local container.

**Learning:** Measured round trip to eu-west-1 is 132ms median against 0.2ms for the local container, roughly 660 times slower, and page load went from 24ms to between 646ms and 1,338ms. The important consequence is that cost now scales with the *number of round trips*, not the amount of data. An N+1 query is a mild inefficiency locally and a visibly hanging page remotely, so the catalogue must fetch items and their images in a single query with `include`. This is worth stating in the Phase 2 presentation: it is a real architectural constraint discovered by measurement, not a guess.

**Learning:** `connection_limit=1`, which pgBouncer needs, also removes query parallelism, so round trips queue and their latencies add rather than overlap. Transactions are worse again, because they hold the connection open across every statement.

## 2026-09-16 — slice 04, item detail page

**Deviation:** Built slice 04 before slice 03, at my own direction rather than in the tracker's dependency order. Two acceptance criteria could not be met as a result and were left explicitly unticked rather than claimed: the back link cannot preserve a category filter that does not exist yet, and the add-to-cart button is rendered in its final position but stores nothing until the cart module lands. Both are recorded on issue #6.

**Challenge:** The detail page took 3.9 seconds to load warm, against 0.66 seconds for the listing page. The dev server showed the whole cost in application code, not framework overhead, so it was database round trips. The cause was my own mistake: `generateMetadata` and the page component each called the same query function, so every request did the work twice, and each call also ran the hold-expiry scan. Four round trips instead of two. Wrapping the read in React's `cache` deduplicates it per request and halved the time to 1.8 seconds. The general lesson is that on a remote database the cost of a page is the number of round trips it makes, and a helper called from two places in the same render is two round trips unless something says otherwise.

**Challenge:** Verifying that user content is escaped gave a false failure first. Piping the page HTML through a shell variable into `grep` reported a raw script tag present, which would have meant a genuine XSS hole. Re-checking by parsing the file directly, and by stripping `<script>` elements before searching the rendered markup, showed zero raw occurrences and both hostile strings correctly escaped. The first result was a shell quoting artefact. A security check that reports a failure deserves a second, differently-implemented check before it is believed in either direction.

**Learning:** Returning `null` for both "item does not exist" and "item is no longer listed" is a small privacy decision, not just convenience. Distinguishing them in the response would let a visitor discover which item identifiers exist. The buyer's next action is identical either way, so one page serves both.

**Learning:** Deposit and balance are derived by subtraction rather than by two separate percentages, so their sum always equals the listed price exactly whatever the rounding did. A test asserts this across eleven prices including ones that round up. Two independent percentage calculations would leave a buyer occasionally owing a stray Naira after paying both parts.

## 2026-09-16 — slice 03, catalogue with category filter

**Learning:** The assessed AJAX interaction is worth more marks when the page still works without it. The catalogue renders its first grid on the server, so the marketplace is complete before any JavaScript runs and works with JavaScript disabled; the filter then enhances it. That is progressive enhancement rather than a single-page application, and it is a stronger answer to the brief than making the whole page depend on `fetch`.

**Learning:** A filter that fires a request per click needs request cancellation, not just a loading flag. Clicking Electronics then Books quickly can return the two responses out of order, leaving Books selected while Electronics items are displayed. An `AbortController` per request, aborting the previous one, removes the race. This is invisible on a fast local database and easy to hit at 130ms per round trip.

**Challenge:** The security of the filter is not in the client at all, it is in the route handler. The category is validated against a Zod enum, and `status: "listed"` is applied unconditionally rather than being derived from input, so no query string can widen the result past what is publicly visible. Tests assert this directly with SQL injection strings, a path traversal attempt and a script tag: each returns 400 and no row is touched. Worth stating in the Phase 2 presentation, because "we validate input" is a weaker claim than a test that tries to break it.

**Learning:** Writing the query schema in one module and importing it into both the route handler and the client component means the shape of the query string cannot drift between the two. The client builds a request the server is guaranteed to accept, and adding a category later is one edit.

## 2026-09-16 — slice 05, cart and cart badge

**Learning:** Deciding that the cart stores item identifiers and nothing else settled several later questions at once. Prices cannot go stale, because they are read fresh on every request. A buyer cannot edit a price in their own browser storage, because there is no price there to edit. And availability, BUY-6, comes free: the same round trip that fetches the price reports whether the item is still listed. Storing a price in the cart would have created three separate problems to solve later.

**Learning:** Making the cart module pure, over an injected storage interface rather than reaching for `window.localStorage`, is what let it be tested at all. Twenty-five tests cover it, including malformed JSON, a JSON value that is not an array, entries that are not strings, duplicate entries, an empty string, and storage that throws on both read and write, which is what a private browsing window does. None of that needed jsdom or a component testing layer. The alternative, reading `window` inside the module, would have forced a whole extra test infrastructure to check the same behaviour.

**Challenge:** Reading `localStorage` during render produces a hydration mismatch, because the server has no storage and renders an empty cart while the browser renders a full one. Fixed by reading storage in an effect after mount and holding a `ready` flag, so the badge renders 0 until the real count is known rather than flickering. The general rule is that anything only the browser knows has to arrive after the first paint, not during it.

**Learning:** The unavailable item deserves to stay visible rather than being silently dropped. A buyer who had a bicycle in their cart and finds it gone needs to see which item went and why, not a cart that quietly shrinks. It is struck through, labelled with a reason, excluded from every total, and still removable.

## 2026-09-17 — slice 06, checkout and confirmation

**Learning:** Two separate mechanisms stop a second order on the same item, and a test proved each one does its job. Checkout claims each item with a conditional update (`status = 'listed'` in the `WHERE`), so a competing checkout waits on the row lock, re-reads the row and updates nothing. Behind that, the partial unique index refuses a second active order outright. Disabling the conditional update left the concurrency test passing, because the index alone still held, and that is the point: the guarantee belongs to the database. Disabling the handler for the index violation made a test fail with a server error. So the constraint is real, and its failure is reported as a `409` rather than leaking as a `500`.

**Learning:** "All or nothing" needs a way to back out of a transaction that has already written. Checkout claims items one by one, then finds one unavailable. Throwing a private error inside Prisma's interactive transaction rolls back the claims already made, and catching that error outside turns it into a result. A test checks that the items that *were* available end up back in `listed`, not stranded `on_hold` with no order.

**Challenge:** Two checkouts that share items can deadlock if they lock the rows in different orders, one holding A and waiting for B while the other holds B and waits for A. Sorting the item identifiers before claiming them means every checkout locks in the same order, so a cycle cannot form. This could not be caught by clicking and is hard to test deterministically, so it is prevented by construction rather than by a test.

**Learning:** The confirmation page reads order ids from its URL, which anyone can edit. Scoping the read to the acting buyer means an id belonging to someone else shows "No order to show" rather than their purchase. A mutation check (removing the `buyerId` filter) confirmed the test catches it.

**Deviation:** The refund terms say an honest rejection is refunded "less a small administrative fee" with no figure, because the amount is PRD §15 open question 1 and was not decided silently here.

**Challenge:** The browser automation used for the Definition of Done's hand check could not reach the dev server (connection refused on `localhost` and `127.0.0.1` while `curl` reached it fine), and blocked `localStorage` on the page. The refusal paths and page rendering were checked with `curl` against the running server instead; the full click-through still has to be done by hand.

## 2026-09-17 — slice 07, accounts, sign-in and phone verification

**Learning:** The guard reads the user row on every request instead of trusting the session token. `phoneVerified` changes mid-session, so a token claiming it would either let an unverified account pay a deposit or keep a verified one out until they signed in again. The token carries the id, email and role for the interface to display, and no server-side decision depends on it. That costs one query per protected request, which is the right trade at this scale.

**Learning:** Injecting the session at the existing route seam, rather than adding a fourth seam for the credentials check, meant replacing exactly one framework call: `getServerSession`. Everything above it, the role check, the phone gate, the ordering of guard before body parse, stays real code under test. The helper gained an `as` option and nothing else changed. Keeping the seam count at three was a design choice, not an accident.

**Challenge:** Removing the seeded demo buyer from `getActingBuyer` broke every slice 06 checkout test at once, which is what should happen: the tests were asserting behaviour that had genuinely changed. Updating them first, watching all twelve fail, then wiring the guard was cheaper than guessing which ones needed a session. The Stage A note that one function would change and no call site would was almost right: no call site changed, but its contract did, from "always a buyer" to "a buyer or nothing", and the confirmation page had to handle the null.

**Learning:** A refusal is returned rather than thrown, the same choice the state machine made for illegal transitions. A thrown guard would surface as a 500 and read as a bug; a returned one is a 401 or a 403 that the interface can act on. Checkout's 403 carries the path to the verification page, so the page links there instead of inferring why the call failed.

**Learning:** The duplicate-email case is decided by the unique constraint, not by reading first and inserting after. A prior read cannot settle it: two simultaneous registrations would both pass the read and one would still have to lose at the insert. A test runs both at once and asserts one 201, one 409, and exactly one row.

**Challenge:** Browser automation still could not reach the dev server, so the hand check was done with `curl` and a cookie jar against the real NextAuth endpoints: fetch the CSRF token, post credentials to the callback, then use the session cookie. That proved sign-in works end to end (a correct password returns a session with the right role, a wrong one returns 401 and no session), that a real checkout as the signed-in buyer records the order and ignores a tampered deposit, and that the confirmation link shows nothing when opened signed out or as a different buyer. The order written during that check was deleted afterwards and its item returned to `listed`, so the development database is as it was. The visual and phone-width pass is still outstanding.

## 2026-09-18 — slice 08, seller submission

**Deviation:** `Item.listedPrice` is not nullable, and at submission nobody has priced anything yet. Rather than change a schema Phase 1 assessed as strong, the requested payout is written to both `sellerPayoutAmount` and `listedPrice`, provisionally. The figure is unreachable while the item is `pending_review`, because every buyer-facing read filters on `status = listed`, and the seller's own list hides it until an admin sets a different price. The alternative, a nullable price column, would have pushed a null through pricing code that is currently total, to represent a state lasting only until the admin opens the queue. Worth a line in the Phase 2 architecture slide: it is implementation pressure on a reviewed schema resolved without changing it, which is what ADR-0001 anticipated.

**Challenge:** The first submission test failed on the description alone: `\n` went in and `\r\n` came out. Multipart encoding normalises a textarea's line endings to CRLF, and a real browser does the same, so the test was right and the code was wrong. Normalising in the Zod schema means text is stored identically however it arrived, rather than carrying stray characters into the rendered paragraphs. A test failing on invisible characters is worth reading carefully before assuming the test is at fault.

**Learning:** A file's declared content type is a claim by the client, so the type is decided by reading the leading bytes instead. A shell script announcing itself as `image/png` is refused, and a test asserts exactly that. The filename is used for nothing at all: the stored name is a generated UUID plus the detected extension, which is what makes path traversal in a filename a non-event rather than something to sanitise.

**Learning:** Uploads have to be all or nothing in the same way orders do. Three photographs where the third is invalid must leave no files on disk and no row in the database, otherwise a refused submission slowly fills the uploads directory. The write loop tracks what it has written and unlinks it on any refusal, and the route removes the files if the database write fails afterwards.

**Challenge:** Importing the upload limits into the submission form would have pulled `node:fs` into the browser bundle, because the same module writes the files. Splitting the two constants into their own module keeps one source of truth for the numbers without dragging the filesystem client-side. The lesson generalises: a constant shared between server and client belongs in a module that imports nothing.

**Learning:** Deriving the photograph previews during render with `useMemo`, rather than setting them from an effect, removed a lint error and a wasted render per photograph. Object URLs still need revoking, so the effect stays, but it only cleans up. Effects are for synchronising with something outside React, not for computing state React can derive.

**Challenge:** The hand check was again done with `curl` rather than a browser. Signed out, `/sell` redirects to sign-in and the route refuses with 401; a signed-in buyer gets 403; a seeded seller's submission returns 201 with `status: pending_review` even though the request also carried `status=listed` and `listedPrice=1`, both ignored. The item was absent from the catalogue API and its detail page returned 404, it appeared on its own seller's page and not on another seller's, and the uploaded file landed under a generated UUID name. The item and its file were removed afterwards, leaving the development database at its seeded fifteen. The visual and phone-width pass is still outstanding for slices 06, 07 and 08.

## 2026-09-22 — slice 09, admin approval, margin and publish

**Learning:** The margin rule is the only place in the project where a figure a user types is compared against a figure the database already holds, and getting the comparison's left and right sides from the same source would have been the bug. The price is checked against `sellerPayoutAmount` read from the row, and a test sends `sellerPayoutAmount: "500"` alongside a price of ₦10,000 to prove the request's copy is ignored. Server-side price authority has so far meant "recompute totals" (§10.4); here it means "decide what the price is allowed to be", which is the same principle pointed the other way.

**Challenge:** Two admins on the same stale queue page could both approve the same item, the second overwriting the first's price. A plain `update` cannot express the condition, so the write is an `updateMany` with the status in the `WHERE` clause: the row moves only if it is still in the state the decision was made against, and a `count` of zero becomes a 409. A test fires both approvals with `Promise.all` and asserts exactly one 200 and one 409. This is the same shape as the one-active-order-per-item rule, solved with a conditional write rather than a partial index because the condition is on the row being changed rather than across rows.

**Learning:** `Prisma.ItemUpdateManyMutationInput` refuses `approvedById`, because a foreign key is only offered through a nested `connect` on the checked input. The unchecked variant takes the scalar. The tests passed before the type error was fixed, because Prisma accepted the field at runtime regardless — a case where `tsc --noEmit` caught something a green suite did not, and an argument for keeping it in the Definition of Done rather than trusting the test run alone.

**Deviation:** ADMIN-3 names images among what the admin may edit before publishing, and this slice edits only the title and description. Reordering or replacing photographs is a second upload interface for a case the queue can already handle by rejecting with a reason, and Stage C is the higher priority. Recorded as a deliberate partial rather than a completed requirement, and noted in the issue.

**Learning:** Scoping `getSubmissionForReview` to `pending_review` means a decided item is a 404 on the review page, so the terminal statuses stay terminal without the page reasoning about them at all. The refusal ends up stated twice — once as an absent read, once as the state machine's 409 on the write — and both are worth having: the first is what a person hits, the second is what a crafted request hits.

**Challenge:** The browser automation still could not reach the dev server, a fourth slice running. The hand check was done with `curl` and a cookie jar against the real NextAuth endpoints, covering the whole round trip: a seller submits, the item appears in the admin queue, the queue redirects a buyer and a seller to the marketplace and a signed-out visitor to sign-in, the route refuses with 401 and 403, a price at or below the payout is refused with a field message, a rejection with no usable reason is refused, approval at ₦26,000 against an ₦18,000 payout publishes the item, the catalogue then serves it with a ₦2,600 deposit derived from the admin's price, a second decision returns 409, the review page 404s, and the seller's own page shows the new price. A submission titled `<script>alert(1)</script>` renders escaped on both new pages. The two items and their uploaded files were removed afterwards and the database re-seeded to its fifteen. **The visual and phone-width pass is still outstanding, now for slices 06 through 09.** That is a Definition of Done line that has not passed, so the checklist items depending on it stay unticked.

**Learning:** Nothing in this slice needed a migration. `rejectionReason` and `approvedById` have been on `Item` since the first migration, written in Stage A when the schema shipped whole. ADR-0001 called constraints added before data exists free and ones retrofitted afterwards a migration problem; three stages later that decision is what let the project's most state-sensitive slice ship as pure application code.

## 2026-09-26 — verification pass over slices 06 to 09

**Challenge:** `prisma migrate deploy` hung for two minutes before anything could be verified. The cause was in `.env`, not the code: `DATABASE_URL` and `DIRECT_URL` were pointing at a hosted Supabase pooler rather than the local container, so every command was waiting on a remote host that had gone away. The committed `.env.example` is correct and local, so a clean clone is unaffected, but it means the hand checks recorded for slices 06 to 09 were run against a hosted database rather than the one the project documents. Fixed for this session by overriding both variables for the processes being run, leaving `.env` untouched. Worth knowing: CLAUDE.md names a hosted database as excluded precisely because the examiner cannot reach one, and a development environment that has drifted onto one will not notice until it breaks.

**Learning:** `node_modules` was empty, so the pass began with `npm install` and turned into a genuine re-run of the reproducibility path — install, migrate, seed, start, browse. That is the R-SETUP claim, exercised by accident rather than design, and it held: 15 items across six categories reaching a rendered page. Also caught that `npx prisma` now resolves to a newer major that no longer has a `migrate` command; `./node_modules/.bin/prisma` is the one the project pins, and `PATH` needs `node_modules/.bin` on it for the seed's `tsx` to resolve.

**Challenge:** `POST /api/cart` returned one line per repeated identifier, so three copies of an item produced three lines and triple the deposit total. Not reachable from the interface, because `src/lib/cart.ts` makes a repeat add a no-op and dedupes on read, but the boundary was not holding the guarantee the client already did. Deduplicated in the Zod schema, preserving order. The lesson is that a rule enforced only on the client is a rule that is true by coincidence: the server had no opinion, and the page priced a cart that checkout would then have refused.

**Learning:** Checking escaping by grepping the served HTML for `<script>alert` is close to useless, because the payload also appears inside Next's RSC flight data as a quoted JSON string, where it is inert. The honest check splits the document into `<script>` blocks and everything else, then asks whether any payload sits in markup context. Doing that showed zero executable payloads across five surfaces, with `&quot;` correctly escaping the quotes inside an `alt` attribute and an input `value`. A test that cannot distinguish dangerous from harmless would have reported six hits on the review page and been dismissed as a false alarm.

**Learning:** Deleting test orders left two items stranded in `on_hold` with no order behind them — a state the application cannot produce, since expiry only releases holds that have an expired order. Cleaning up after a hand check means reasoning about the state machine, not just deleting rows: the fix was to return any `on_hold` item with no active order to `listed`.

**Deviation:** Seven checklist items were ticked in this pass rather than at their own slices' close-out, because the Definition of Done's hand-check line had been carried forward unverified since slice 06. T-RESPONSIVE remains unticked: it needs a real narrow viewport, and the two Chrome browsers reachable from this session are on Windows and Linux while the dev server is on this Mac's localhost, which is the likely reason the browser step has failed for four slices running.

## 2026-09-26 — slice 10, information request relay

**Deviation:** `Thread` gained a nullable `buyerId`, recorded as [ADR-0002](adr/0002-thread-buyer-identity.md). The Phase 1 model gave a thread an item and an optional order but no person, which is enough for a direct thread (it inherits a buyer through its order) and not enough for a relay thread, which exists before any order does. Without it, two buyers asking about the same item could not be told apart. One relay thread per buyer per item is enforced by a partial unique index over `threadType = 'relay'`, the same technique as `orders_one_active_per_item`. The Phase 1 ERD is now one column out of date, deliberately, which belongs on the Phase 2 challenges slide.

**Learning:** Masking has to happen at serialisation, not at render. If the interface hides a name the server has already sent, a curious seller reading the network tab still has it. Dropping identity before the response leaves means there is nothing in the browser to find, and the tests assert it by searching the **whole** serialised response for the buyer's id, name, email and phone rather than checking one field. A test that checked `from === "a buyer"` would have passed against a response that still carried `senderId`.

**Learning:** There is a second, quieter leak: counting. Even with every name removed, a seller who could see how many conversations exist about an item would learn how many people are interested, which is the same disclosure MSG-2 forbids by another route. The seller's list is built per thread and carries no total, and a test asserts that one buyer's message never appears in another's thread.

**Learning:** A withheld message is not deleted. It moves to `admin_only`, which keeps it readable by the admin and by whoever wrote it, and invisible to the other side. That gives mediation an audit trail and means a buyer whose message was stopped can still see what they sent, rather than watching it vanish. The rule that a sender always keeps sight of their own words turned out to be one line in the visibility check and worth more than it cost.

**Challenge:** Two simultaneous first questions from the same buyer would race to create a thread. Rather than fail the second, the unique-index violation is caught and the message is written to the thread that won, so the buyer's question lands either way. This is the same pattern as checkout's conflict handling, except that here a conflict is recoverable rather than terminal, because there is no money involved and the intent is unambiguous.

**Challenge:** Next 16 refuses to start a second dev server for the same project whatever port is given, so the hand check could not run alongside the server left over from the previous session. Stopping the old one was the fix. Worth knowing because the error names a running server on another port and reads like a port conflict, which it is not.

**Note for the next session:** the migration is applied to the local `declutter` and `declutter_test` databases only. The hosted Supabase database that `.env` points at has not had it, so thread queries there will fail until `prisma migrate deploy` is run against it with `DIRECT_URL` set to the session pooler.

## 2026-09-26 — slice 11, the deposit opens a direct thread

**Learning:** The deposit is a privacy boundary, not just a payment. Before it, the two parties are anonymous to each other and every message waits on the admin. After it, they are committed to meeting in a real place, so mediation would obstruct rather than protect: messages go straight through, and the buyer receives the seller's name and phone. Putting that rule in one function, `getOrderFor`, means no page has to remember it, and the test asserts the details are absent from every buyer-facing response before a deposit exists.

**Learning:** The asymmetry is the interesting part and needed saying in the interface, not just the code. The buyer gets the seller's phone number because the buyer has money at risk and is travelling to meet a stranger. The seller gets a first name, because the platform holds the money and the item has not moved. Left unexplained it reads as an oversight; explained on both pages it reads as the design. PRD §15 open question 3 asks whether sellers should eventually get more, and this slice deliberately does not answer it.

**Learning:** Reusing the relay's serialiser for direct threads came down to one branch on `threadType`. A relay names nobody; a direct thread names both. Two serialisers would have been two places for a masking bug to hide, and the existing tests that search the whole response body for the counterparty's identifiers carried over unchanged.

**Challenge:** The first run of the new tests had a direct message stored as `buyer_and_admin`, because `writeMessage` was addressing visibility from the sender's role alone. Correct for a relay, wrong for a direct thread, where there is nothing left to review. Passing the thread type in fixed it. The symptom is worth remembering: a rule that was right when written can become wrong when a second case appears, and the test that caught it was asserting the stored value rather than what the page showed.

**Challenge:** Mid-slice I ran `git checkout src/lib/checkout.ts` to undo a deliberate mutation test and silently reverted the uncommitted feature work in that file alongside it. The full suite caught it immediately, eleven failures, and re-applying took a minute. The lesson is that `git checkout <file>` discards everything uncommitted in that file, not just the last edit, so restoring from a copy made before the mutation is the safer habit. Committing the feature before mutation testing would have avoided it entirely.

**Learning:** Opening the thread inside the checkout transaction is a deliberate coupling. A buyer charged for an item with no way to arrange collection is worse than a failed checkout, so the thread is part of the same all-or-nothing guarantee. A test asserts that a refused checkout leaves no threads as well as no orders.

## 2026-09-26 — slice 12, the meetup map

**Learning:** A proposal is not an agreement, and a single stored point cannot tell the two apart. The first design was one set of coordinates on the order, which would have made "agree a meetup point" mean "somebody typed a place", and §14.7 asks for agreement between two people. Splitting it into propose then accept, with the proposer barred from accepting their own suggestion, is a few extra lines and is the difference between the feature meaning something and not.

**Deviation:** The proposal state is derived from the two server-written messages in the direct thread rather than from new columns. Adding `meetupProposedById` and `meetupAgreedAt` would be less indirect, and it would change a schema Phase 1 assessed as strong for something the thread already has to record: both the proposal and the acceptance appear in the conversation regardless, because the thread is meant to be the narrative of the handover. The prefixes those messages carry are written and matched in one module, so they are a record rather than a guess about user text. Worth revisiting if a later slice needs the state in a query.

**Learning:** Leaflet is the first runtime dependency added since the skeleton, and it was chosen in Phase 1 for exactly the reason it earned its place now: OpenStreetMap tiles need no API key, no account and no billing relationship. It loads through a dynamic import on the order page alone, because the library touches `window` at module scope and would otherwise break server rendering as well as weighing down the marketplace bundle.

**Learning:** The map had to be optional. A tile server outage should not stop two people agreeing where to meet, so the coordinates, the label and the accept action all live outside the map component, and a failed tile load shows a short explanation rather than an empty grey box. The map is the convenient way to pick a point, not the only way a point exists.

**Challenge:** Leaflet's default marker icons resolve through a CSS URL that a bundler rewrites, so markers silently fail to appear. Defining the marker as a `divIcon` with inline styling avoids the asset pipeline entirely and keeps the pin in the project's own green.

**Learning:** LOC-3 asks the interface to encourage public meeting points, and the temptation was to enforce it. There is no reliable way to know whether a coordinate is somebody's home, so the advice sits beside the map as copy and nothing is ever refused for being in the wrong sort of place. Guidance that blocks people is a rule wearing a disguise, and a wrong refusal here would be worse than no advice.

## 2026-09-26 — slice 13, orders view and a new palette

**Challenge:** Paying a deposit left a buyer with nowhere to go. The confirmation page is reachable only from the checkout that produced it, so an order existed in the database with no route back to it in the interface. The cause was a gap between two slices rather than a bug: the orders list was built in Stage C, which is not on this branch. Adding `/orders` and `/orders/[id]` here, scoped to the acting buyer, closes it. The lesson is that a slice can be complete against its own acceptance criteria and still leave a journey with a dead end, and only walking the journey shows it.

**Deviation:** The interface moved from the original green to indigo and amber. The Phase 1 wireframes were assessed as strong and the green matched the concept diagrams, so this is a deliberate divergence, taken because the interface read as flat and undifferentiated: one accent was carrying active state, links, primary actions and the cart badge at once, so nothing stood out. Splitting the work between two colours, indigo for what is true and amber for what can be done, gives the eye somewhere to go. The cost is that the concept document and the four diagrams no longer match the screenshots, and the Phase 2 deck has to name it as a refinement rather than let a marker notice it first.

**Learning:** A palette swap is a two-part job, and the second part is where the design actually changes. Replacing hex values across twelve files took one pass and left the interface looking exactly as flat as before, because the structure was unchanged. What made the difference was assigning roles: a grey page so white cards read as raised, softer borders, rounder corners, and amber reserved for the three actions that move a purchase forward. Colour values are not a design; the decisions about where they go are.

**Learning:** Changing the page background from white broke every bordered card at once, silently. Each had a border and no background of its own, so they all sank into the new grey ground. Worth knowing before a repaint: a card is a background plus a border, and anything relying on the page being white is invisible the moment it is not.

## 2026-09-27 — slice 14, the unavailable states

**Deviation:** An item that exists but cannot be bought now shows its image, title, condition and struck-through price with a reason, where before it was indistinguishable from an id that was never issued. That earlier rule was recorded as a privacy decision in slice 04, and reversing it was a judgement about who was paying for it. Ids are cuids, so anybody holding one has already seen the item; the people the rule actually inconvenienced were buyers whose cart item vanished and who were shown a generic refusal that could not tell them which item went. An invented id still returns nothing, so the probing case the rule was written against is unchanged.

**Learning:** A state has to be legible in more than one channel. The cart already struck the price through and named the reason, and it still read as noise because both signals were the same size and weight as everything around them. Adding a tag chip gives the eye something to catch first, and the struck price and the sentence then explain it. The accessibility rule about never encoding meaning in colour alone turns out to be a design rule as much as an accessibility one: three channels carrying the same message is what makes a state obvious rather than merely present.

**Learning:** The generic page was cheaper to write and worse in every way that mattered. It could not say which item, could not show what it looked like, and offered nothing to do next. The replacement carries the gallery image in greyscale, the reason in the buyer's words, what happens next for each reason, and two actions. Same data, already in the database, and the only thing standing between the buyer and it was a read that refused to return it.

## 2026-10-29, Phase 2 feedback, between phases

**Deviation:** The Phase 2 deck's "Next" panel said the `full-scope` work would be folded back into `main` for Phase 3. It will not be. The tutor accepted the reduced buyer journey and asked for that scope to be stated clearly, so Phase 3 finalises it, and `full-scope` is described as further work. Recorded in `docs/phase2-feedback.md`.

**Challenge:** The tutor reported the wireframes as missing from the repository, though they had existed since slice 01 and the checklist had them ticked. The cause was our own `.gitignore`, which kept `docs/` and the wireframe sources local so the repository would carry only code and the README. The work existed; the person grading could not see it. `docs/` is now published, with the wireframes under `docs/wireframes/`.

**Learning:** A tick in the checklist records that something was done, not that the grader can find it. Evidence has to be checked from the grader's side: a clean clone of the public repository, and the exported PDF rather than the deck in the editor. The broken title-slide link came from the same blind spot. The URL was stored as four text runs with no hyperlink, which looked fine in PowerPoint and came apart in the export.

**Learning:** A deck drifts from the code faster than a README does, because nothing tests it. The README had already been rewritten to describe `main` honestly, while the deck still claimed role guards and NextAuth, both of which exist only on `full-scope`. Every factual claim on a slide needs the same question asked of it as of the README: true of which branch?

**Deviation:** The slice 01 wireframes no longer matched the submission. They drew "Sell an item", "Ask a question" and card fields at checkout, none of which this branch has, and had no orders page. Publishing them as they were would have repeated the deck's problem of claiming more than was built. They were redrawn from the built pages instead: six greyscale wireframes at desktop and phone width, generated from plain HTML by one script, each published beside a screenshot of the page as built. The originals are kept under `docs/wireframes/source/`, with what changed listed in that folder's README.

**Challenge:** The first phone renders came out cropped on the right with the cart button missing. Headless Chrome will not size a window below about 500px, so each page was laid out at that width and then cut to 390. Rendering the page inside an iframe of exactly 390px makes the phone media query apply, and the screenshot is cropped to the iframe.
