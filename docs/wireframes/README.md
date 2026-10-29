# Wireframes

Greyscale wireframes of the buyer's purchase journey, one per page at desktop and phone width, with a
screenshot of the built page beside each. They fix layout and hierarchy, not finished visuals.

**Green marks the three assessed AJAX interactions**, each an explicit `fetch` against a JSON route
handler: the category chips and sort (`GET /api/items`), the cart badge with the cart's Remove and
summary (`POST /api/cart`), and the Pay button (`POST /api/checkout`). Everything else is grey.

## The journey

| Step | Wireframe | Built page | What it settles |
|---|---|---|---|
| 1 Catalogue | [desktop](png/1-catalogue-desktop.png) · [phone](png/1-catalogue-phone.png) | [desktop](screenshots/1-catalogue-desktop.png) · [phone](screenshots/1-catalogue-phone.png) | Category chips and sort re-render the grid with no reload. Every card states the deposit beside the price |
| 2 Item detail | [desktop](png/2-item-detail-desktop.png) · [phone](png/2-item-detail-phone.png) | [desktop](screenshots/2-item-detail-desktop.png) | The deposit and the balance are stated before any commitment. Add to cart updates the badge in place |
| 3 Cart | [desktop](png/3-cart-desktop.png) · [phone](png/3-cart-phone.png) | [desktop](screenshots/3-cart-desktop.png) · [phone](screenshots/3-cart-phone.png) | Prices and availability are re-read on every load. An item reserved by someone else is struck through and excluded from the total (BUY-6) |
| 4 Checkout | [desktop](png/4-checkout-desktop.png) · [phone](png/4-checkout-phone.png) | [desktop](screenshots/4-checkout-desktop.png) · phone [top](screenshots/4-checkout-mobile-1.png), [scrolled](screenshots/4-checkout-mobile-2.png) | The simulated-payment notice sits at the top. Refund terms come before payment, and Pay stays disabled until they are accepted (PRD §9). No card details are asked for |
| 5 Confirmation | [desktop](png/5-confirmation-desktop.png) · [phone](png/5-confirmation-phone.png) | desktop [top](screenshots/5-confirmation-desktop-1.png), [scrolled](screenshots/5-confirmation-desktop-2.png) · phone [top](screenshots/5-confirmation-mobile-1.png), [scrolled](screenshots/5-confirmation-mobile-2.png) | One order per item, so a two-item cart produces two references. Each shows the deposit paid, the balance outstanding and the hold expiry, read back from the order rows |
| 6 Your orders | [desktop](png/6-orders-desktop.png) · [phone](png/6-orders-phone.png) | [desktop](screenshots/6-order-page-desktop.png) · [phone](screenshots/6-order-page-mobile.png) | Every order this buyer has placed, with its status. A lapsed hold is evaluated when the page is read, with no scheduled job |

## At phone width

The header keeps only the logo and the cart. Category chips scroll sideways and sort moves below them.
Every two-column layout stacks, with the order or cart summary after the list, and the confirmation's
order links become full-width buttons.

## Data between the steps

The annotated page flow, covering what each step passes to the next and where the cart lives, is
[`../diagrams/buyer_flow.png`](../diagrams/buyer_flow.png). In short: the cart holds item identifiers
only, in `localStorage`. Checkout sends those identifiers, and the server re-reads every price and
availability before writing one order per item.

## How these relate to the slice 01 wireframes

The first wireframes were drawn in slice 01, before any interface code, in answer to the Phase 1
feedback. They are kept under `source/`. These were redrawn from the built pages so the wireframes and
the submission agree. What changed between the two:

- The slice 01 set drew "Sell an item" in the header and "Ask a question about this item" on the detail
  page. Both belong to the full concept (seller submission and the anonymised relay) and are not part
  of this submission. See [`../phase2-feedback.md`](../phase2-feedback.md).
- The checkout drew card fields. The built checkout asks for none, since the payment is simulated.
- The phone header had a menu. The built one hides the Orders link instead.
- The orders page did not exist. It was added in slice 13.

## Files

- `png/` holds the wireframes, readable directly on GitHub.
- `screenshots/` holds the built pages, taken from the running application with the seeded catalogue.
- `pages/` holds the wireframes as plain HTML, sharing `wireframe.css`. Each page opens in a browser and
  is responsive, so narrowing the window shows the phone layout.
- `render.py` writes `pages/` and renders `png/`. It needs Google Chrome and Pillow.
- `source/` and `declutter-wireframes.html` are the slice 01 wireframes, kept as the original.
