# ADR-0002: A relay thread belongs to one buyer, recorded on the thread

**Status:** Accepted · **Date:** 2026-09-26
**Context docs:** PRD §7.5, §11, [ADR-0001](0001-phase2-build-order.md), [Phase 1 feedback](../phase1-feedback.md)

## Context

Stage C opens with the information request relay (PRD §14.4, MSG-1, MSG-2): a buyer asks a question about an item before any deposit exists, the admin sees it unmasked, and the seller answers without learning who asked.

The Phase 1 data model gives `Thread` an `itemId` and a nullable `orderId`, and gives `Message` a `visibleTo` enum whose values are `both`, `admin_only`, `buyer_and_admin` and `seller_and_admin`. Neither carries a person.

That is sufficient for a direct thread, which hangs off an order and therefore inherits exactly one buyer through `Order.buyerId`. It is not sufficient for a relay thread, which exists before any order does. Two buyers asking about the same bicycle produce two enquiries with nothing in the schema to tell them apart, and `visibleTo = buyer_and_admin` means "a buyer", not "that buyer". The consequences are concrete:

- A second buyer's enquiry cannot be distinguished from the first, so a reply is deliverable to the wrong person.
- Showing a buyer their own enquiry requires knowing which thread is theirs.
- The seller would be able to infer how many separate people are interested, which is more than the relay is meant to disclose.

This is implementation pressure on a schema Phase 1 assessed as strong, which ADR-0001 anticipated and which the working agreement says to record rather than absorb silently.

## Decision

Add a nullable `buyerId` to `Thread`, with a foreign key to `User`, and enforce one relay thread per buyer per item with a partial unique index on `(itemId, buyerId)` restricted to `threadType = 'relay'`.

- **Relay threads** carry a `buyerId` and no `orderId`. The column is the thread's owner.
- **Direct threads** carry an `orderId` and a `buyerId` equal to that order's buyer, written at creation. Denormalised deliberately: it makes "threads this person can see" one predicate rather than two, and the order's buyer never changes, so the copy cannot drift.
- The column stays **nullable** because the schema must keep admitting a thread with no single buyer if one is ever needed, and because a non-null constraint would have to be retrofitted onto rows that do not exist yet.

`Message.visibleTo` is unchanged. It answers "which side of the relay may read this line", and the thread now answers "which person is that side". The two together are enough; making `visibleTo` person-shaped would duplicate what the foreign key already states.

The partial unique index is the same technique the project already relies on for one active order per item, and for the same reason: the guarantee belongs in the database, not in application code that a later route could forget.

## Consequences

- **A second migration.** The first migration shipped the whole schema, so this is the first time the project adds one. It is additive: a nullable column, an index and a foreign key, with no data to backfill because no threads exist yet. `prisma migrate deploy` followed by `prisma db seed` must still produce a browsable catalogue on a clean clone.
- **The ERD in the Phase 1 submission is now one column out of date.** `Declutter_Phase1_ERD.pdf` is a submitted artefact and is not edited. The Phase 2 presentation shows the current model and names this change as a deviation, which is exactly what the brief's challenges slide asks for. The reflection journal carries the same entry.
- **Prisma cannot express a partial unique index**, so it is raw DDL appended to the generated migration, generated with `--create-only` then edited, as the first migration did for `orders_one_active_per_item`. Verify it in `pg_indexes` rather than trusting the file was applied.
- **Thread queries gain a buyer predicate.** Reading a buyer's own relay threads filters on `buyerId` from the session, never from a URL, in the same way the seller's submissions list and the confirmation page already do.
- **One enquiry thread per buyer per item**, enforced. A buyer asking a second question continues their existing thread rather than opening another, which is also what makes the seller's view coherent: one conversation per interested party.
- The admin's unmasked visibility (MSG-7) is unaffected. The admin reads every thread regardless of `buyerId`.

## Alternatives considered

**Derive the owner from the earliest buyer-role message.** No schema change, which was its appeal, and rejected for three reasons. The rule would live in every query that touches a thread rather than in one column, so a route that forgot it would silently show one buyer another's conversation. It cannot be enforced: nothing stops two threads for the same buyer and item existing. And it makes a thread's identity depend on its contents, so deleting or hiding a message could change who owns the conversation.

**One shared relay thread per item, with all buyers in it.** Simplest by some distance, and rejected on the requirement rather than on effort: MSG-2 says a relay thread never exposes buyer identity to the seller, and a shared thread exposes how many separate people are asking, which is the shape of the same disclosure. It would also make masking a per-message concern for every reader rather than a property of the thread.

**Put the buyer on `Message` only.** Rejected because it answers the question one message at a time. Listing a seller's open enquiries would mean aggregating messages to discover which threads exist, and the uniqueness rule still could not be stated.
