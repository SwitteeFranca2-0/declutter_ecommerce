# Declutter

An escrow-mediated peer-to-peer marketplace for used goods.

Buyers and sellers of second-hand items normally have to trust each other. Declutter removes that requirement by placing an identified intermediary between them: listings are curated and priced by an operator, payment is held by the platform rather than passed directly to the seller, the two parties stay anonymous to each other until a deposit is placed, and physical handover is confirmed by a single-use PIN that only a buyer who has actually paid can produce.

Built as the coursework project for **DLBITPEWP01_E — Project: Getting Started in Web Programming** (Task 2, E-Commerce Site).

## Status

**Planning.** No application code has been written yet — this repository currently contains only this README. Implementation begins from the project PRD, which is not published here.

## How it works

| Stage | What happens |
|---|---|
| Submission | A seller submits an item and the amount they want to receive |
| Curation | The operator edits the listing and sets the public price; the difference is the platform margin |
| Enquiry | Buyers ask questions through an anonymised relay — neither party sees the other |
| Deposit | A 10% deposit places the item on hold for 72 hours and opens a direct channel |
| Balance | The buyer pays the remainder and receives a handover PIN |
| Handover | The seller enters the PIN in person, which releases the payout |

An item moves through `pending_review → listed → on_hold → sold → completed`, with at most one active order against it at any time.

## Planned stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | NextAuth (Credentials) |
| Styling | Tailwind CSS + shadcn/ui |
| Maps | Leaflet + OpenStreetMap |

Chosen so the project runs from a clone with a local PostgreSQL instance and no paid services, hosted providers, or API keys.

## Getting started

Setup instructions will be added here alongside the first application code. They are omitted rather than written in advance so that everything documented in this file is known to work.

## Scope

Payments, SMS verification, seller payouts, and hold expiry are deliberately simulated — the brief does not require real payment processing, and simulating them keeps the project runnable by an assessor without external accounts. Dispute resolution, ratings, reputation, and search ranking are out of scope.

## Licence

Academic coursework. Not licensed for reuse.
