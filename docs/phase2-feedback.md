# Phase 2 Tutor Feedback

**Received:** 2026-10-29 · **Verdict:** proceed directly to Phase 3, no Phase 2 resubmission

## Summary

Paraphrased rather than quoted, as with the Phase 1 feedback.

Phase 2 was accepted. The reduction to the buyer's purchase journey was recognised as a successful scale-down, and the deck's screenshots and journey maps were judged to cover the functional intent. Three things need fixing on the way into Phase 3:

1. The GitHub URL on the title slide is broken: it renders with stray spaces and does not work as a link.
2. Some slide claims are stronger than the submission branch supports. The deck describes role guards returning 401 or 403, and lists NextAuth, while `main` has no sign-in and acts as a single seeded buyer.
3. The deck leans on the full escrow framing in places, which reads as confusing next to a submission that delivers a simplified buyer checkout.

One optional request: put the wireframe sketches in a `docs/` folder in the repository. They were missing from GitHub because `docs/` and the wireframe sources were excluded by `.gitignore`.

## Decisions taken

| # | Point | Response | Status |
|---|---|---|---|
| 1 | Title slide URL | One text run with a real hyperlink, so a PDF export keeps it whole and clickable | Done in the local deck |
| 2 | Role guard and auth claims | Reworded to what `main` does: checkout acts as one seeded buyer, and an order read is scoped to that buyer. Guards and NextAuth are attributed to `full-scope` | Done in the local deck |
| 3 | Escrow wording | The title subtitle and the concept slide say what this build delivers: a deposit-backed purchase journey. The full concept is framed as the idea, not the deliverable | Done in the local deck |
| 4 | Wireframes in the repository | `docs/` published. [`docs/wireframes/`](wireframes/) holds greyscale wireframes of all six buyer pages at desktop and phone width, redrawn from the built pages, each beside a screenshot of the page as built. The slice 01 originals are kept alongside | Done |
| 5 | Scope clarified in documentation | README opens with the scope and points here | Done |

The deck is not resubmitted. It is attached to the Phase 3 submission (checklist P3-ARTIFACTS), so the corrected version is the one that goes in.

## Scope for Phase 3

**The reduced buyer journey stays the submission scope.** Phase 3 finalises `main` rather than merging `full-scope` into it. The tutor accepted the reduced scope, and merging roughly 8,000 lines of auth, seller, admin, relay and map work at this stage would add more to defend than it adds to the grade. `full-scope` stays published as further work and is named as such in the abstract.

This changes the deck's Phase 2 "Next" panel, which listed "Fold full-scope back in". That line is superseded.

## Found while preparing the screenshots

Three gaps in the built pages, none blocking, all for Phase 3:

1. At phone width the Orders link is hidden (`src/app/header.tsx`) and there is no menu, so a buyer on a phone can reach their orders only from a confirmation page.
2. On the orders page an expired hold shows its status twice, as a tag and a chip.
3. An expired order still reads "₦X paid, ₦Y on collection", though nothing will be collected. The page, the refund terms (half the deposit kept when a hold lapses without contact) and the deck's slide 7 (which says the deposit is refunded) need to agree.
