# Wireframes

Greyscale wireframes for the buyer's purchase journey, drawn in slice 01 before any interface code, in
answer to the Phase 1 feedback. They fix layout and hierarchy, not finished visuals. Green marks the two
assessed AJAX interactions: the category filter and the cart badge.

The built interface later moved to an indigo and amber palette (journal, slice 13). The layouts are
otherwise what was built.

## Desktop, in journey order

| Step | Wireframe | What it settles |
|---|---|---|
| 1 | [Catalogue](png/1-catalogue-desktop.png) | Category chips re-render the grid with `fetch`, no reload. Every card states the deposit beside the price |
| 2 | [Item detail](png/2-item-detail-desktop.png) | The deposit and the balance are stated before any commitment |
| 3 | [Cart](png/3-cart-desktop.png) | An item reserved by someone else is greyed, struck through, excluded from the total and still removable (BUY-6) |
| 4 | [Checkout](png/4-checkout-desktop.png) | The simulated-payment banner sits at the top. Refund terms come above the payment form, with an explicit accept (PRD §9) |
| 5 | [Confirmation](png/5-confirmation-desktop.png) | One order per item, so a two-item cart produces two references. The hold expiry is a real date |

## Phone width

| Wireframe | What changes |
|---|---|
| [Catalogue](png/1-catalogue-phone.png) | The nav collapses to a menu, chips scroll sideways, and the grid drops to one column |
| [Cart](png/3-cart-phone.png) | The summary moves from beside the list to the end of it. The cart badge stays visible at every width |

## Data between the steps

The annotated page flow, covering what each step passes to the next and where the cart lives, is
[`../diagrams/buyer_flow.png`](../diagrams/buyer_flow.png). In short: the cart holds item identifiers
only, in `localStorage`. Checkout sends those identifiers, and the server re-reads every price and
availability before writing one order per item.

## Elements outside the submission scope

The detail page draws "Ask a question about this item", and the header draws "Sell an item". Both
belong to the full concept (the anonymised relay and seller submission) and were placed so the layout
would not need to change later. They are not part of the submitted buyer journey. See
[`../phase2-feedback.md`](../phase2-feedback.md).

## Sources

- `png/` holds renders of each artboard, readable directly on GitHub.
- `source/` holds the artboard HTML and `canvas.json`, which gives each artboard's position and the
  annotation notes.
- `declutter-wireframes.html` is the whole canvas exported as one file from the design tool, kept as
  the original. The PNGs are the reliable way to view the wireframes.
