#!/usr/bin/env python3
"""
Generates the Phase 1 (Conception) deliverables for DLBITPEWP01_E.

  Uvere-Franca_92134098_WebProgramming_P1_S.pdf      concept document (2 pages)
  Uvere-Franca_92134098_WebProgramming_P1_S_ERD.pdf  entity relationship diagram

The diagrams are exposed as standalone drawing functions so that
docs/export_diagrams.py can emit them as images for the DOCX version without
duplicating any drawing code.

House style: no em dashes anywhere in the output.

Run:  python3 docs/generate_phase1.py
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

# ---------------------------------------------------------------- identity ---
NAME = "Franca Swittee Uvere"
MATRIC = "92134098"
COURSE = "DLBITPEWP01_E, Project: Getting Started in Web Programming"
REPO = "https://github.com/SwitteeFranca2-0/declutter_ecommerce"
STEM = "Uvere-Franca_92134098_WebProgramming_P1_S"

# ----------------------------------------------------------------- palette ---
INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#5A5A5A")
RULE = colors.HexColor("#D4D4D4")
ACCENT = colors.HexColor("#1E5F4B")
FILL = colors.HexColor("#F2F5F4")
CLIENT = colors.HexColor("#2C5F8A")
SERVER = ACCENT
DATA = colors.HexColor("#7A4E8C")
STUB = colors.HexColor("#9A6B2F")

M = 2 * cm
W, H = A4

body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.2, leading=13.2,
                      textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6)
small = ParagraphStyle("small", parent=body, fontSize=8.2, leading=11.4)
tiny = ParagraphStyle("tiny", parent=body, fontSize=7.2, leading=9.4,
                      textColor=MUTED, alignment=0)


# ------------------------------------------------------------- primitives ---
def heading(c, x, y, text):
    y -= 9
    c.setFont("Helvetica-Bold", 10.5)
    c.setFillColor(ACCENT)
    c.drawString(x, y, text)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(x, y - 4, W - M, y - 4)
    return y - 16


def section(c, x, y, text):
    y -= 14
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, text)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(x, y - 5, W - M, y - 5)
    return y - 18


def para(c, x, y, text, width, style=body):
    p = Paragraph(text, style)
    _, h = p.wrap(width, 1000)
    p.drawOn(c, x, y - h)
    return y - h - 5


def box(c, x, y, w, h, label, lines, colour, dashed=False):
    """Rounded box with a bold label and small body lines. y is the TOP edge."""
    c.saveState()
    if dashed:
        c.setDash(2.2, 2.2)
    c.setStrokeColor(colour)
    c.setLineWidth(1.0)
    c.setFillColor(colors.white if dashed else FILL)
    c.roundRect(x, y - h, w, h, 3, stroke=1, fill=1)
    c.restoreState()

    c.setFillColor(colour)
    c.setFont("Helvetica-Bold", 7.6)
    c.drawCentredString(x + w / 2, y - 11, label)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.6)
    ty = y - 21
    for ln in lines:
        c.drawCentredString(x + w / 2, ty, ln)
        ty -= 8.2


def _head(c, x2, y2, ang):
    import math
    for s in (1, -1):
        c.line(x2, y2,
               x2 - 4.5 * math.cos(ang + s * 0.38),
               y2 - 4.5 * math.sin(ang + s * 0.38))


def arrow(c, x1, y1, x2, y2, label="", dashed=False, both=False,
          label_below="", size=5.8):
    import math
    c.saveState()
    c.setStrokeColor(MUTED)
    c.setLineWidth(0.8)
    if dashed:
        c.setDash(2, 2)
    c.line(x1, y1, x2, y2)
    ang = math.atan2(y2 - y1, x2 - x1)
    _head(c, x2, y2, ang)
    if both:
        _head(c, x1, y1, ang + math.pi)
    c.restoreState()
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", size)
    if label:
        c.drawCentredString(mx, my + 3.4, label)
    if label_below:
        c.drawCentredString(mx, my - 8.2, label_below)


# ------------------------------------------------- reusable diagram blocks ---
def draw_architecture(c, x0, top, cw):
    """Three-tier architecture diagram. Returns the height consumed."""
    bw, bh = 4.55 * cm, 2.45 * cm
    gap = (cw - 3 * bw) / 2
    x1, x2, x3 = x0, x0 + bw + gap, x0 + 2 * (bw + gap)

    box(c, x1, top, bw, bh, "CLIENT (BROWSER)",
        ["Buyer / Seller / Admin UI", "React + Tailwind CSS", "Fetch API, JSON, DOM",
         "Leaflet map"], CLIENT)
    box(c, x2, top, bw, bh, "APPLICATION SERVER",
        ["Next.js route handlers", "Auth + role guards", "State machine, PIN logic",
         "Server-side price authority"], SERVER)
    box(c, x3, top, bw, bh, "DATABASE",
        ["PostgreSQL via Prisma", "users, items, item_images",
         "orders, threads, messages", "payouts"], DATA)

    mid = top - bh / 2
    arrow(c, x1 + bw + 4, mid, x2 - 4, mid, "HTTP / fetch", both=True,
          label_below="HTML / JSON")
    arrow(c, x2 + bw + 4, mid, x3 - 4, mid, "Prisma", both=True, label_below="rows")

    ty = top - bh - 1.15 * cm
    box(c, x1, ty, bw, 1.25 * cm, "OPENSTREETMAP", ["map tiles, no API key"],
        STUB, dashed=True)
    box(c, x2, ty, bw, 1.25 * cm, "SIMULATED SERVICES", ["payment, SMS, payout"],
        STUB, dashed=True)
    box(c, x3, ty, bw, 1.25 * cm, "LOCAL FILESYSTEM", ["listing image uploads"],
        STUB, dashed=True)
    for xx in (x1, x2, x3):
        arrow(c, xx + bw / 2, top - bh - 3, xx + bw / 2, ty + 3, "", dashed=True)

    return top - (ty - 1.25 * cm)


def draw_state_machine(c, x0, sy, cw):
    """Item lifecycle state machine. Returns the height consumed."""
    sw, sh = 2.02 * cm, 0.92 * cm
    g = (cw - 5 * sw) / 4
    states = ["pending_review", "listed", "on_hold", "sold", "completed"]
    xs = [x0 + i * (sw + g) for i in range(5)]
    labels = ["approve", "deposit paid", "balance paid", "PIN redeemed"]

    def state_box(x, top, text, dashed=False):
        c.saveState()
        if dashed:
            c.setDash(2, 2)
            c.setStrokeColor(MUTED)
            c.setFillColor(colors.white)
        else:
            c.setStrokeColor(ACCENT)
            c.setFillColor(FILL)
        c.setLineWidth(1)
        c.roundRect(x, top - sh, sw, sh, 3, stroke=1, fill=1)
        c.restoreState()
        c.setFillColor(MUTED if dashed else ACCENT)
        c.setFont("Helvetica-Bold", 6.6)
        c.drawCentredString(x + sw / 2, top - sh / 2 - 2.2, text)

    for i, st in enumerate(states):
        state_box(xs[i], sy, st)
        if i < 4:
            arrow(c, xs[i] + sw + 3, sy - sh / 2, xs[i + 1] - 3, sy - sh / 2, labels[i])

    ry = sy - sh - 1.15 * cm
    state_box(x0, ry, "rejected", dashed=True)
    arrow(c, x0 + sw / 2, sy - sh - 3, x0 + sw / 2, ry + 3, "")
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", 5.8)
    c.drawString(x0 + sw / 2 + 5, (sy - sh + ry) / 2 - 2, "reject")

    dy = ry + sh * 0.55
    c.saveState()
    c.setStrokeColor(MUTED)
    c.setDash(2, 2)
    c.setLineWidth(0.8)
    c.line(xs[2] + sw / 2, sy - sh - 3, xs[2] + sw / 2, dy)
    c.line(xs[2] + sw / 2, dy, xs[1] + sw / 2, dy)
    c.restoreState()
    arrow(c, xs[1] + sw / 2, dy, xs[1] + sw / 2, sy - sh - 3, "", dashed=True)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", 5.8)
    c.drawCentredString((xs[1] + xs[2]) / 2 + sw / 2, dy - 8,
                        "hold expires (72h), returns to listed")

    return sy - (ry - sh)


# ================================================================ PAGE ONE ===
def page_one(c):
    y = H - M
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(M, y - 6, "Declutter: Concept Document")
    y -= 22
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(M, y, "Portfolio Phase 1 (Conception)  ·  " + COURSE)
    y -= 10
    c.drawString(M, y, "Project type: E-Commerce Site (Task 2)")
    y -= 10
    c.drawString(M, y, "Name: %s   ·   Matriculation number: %s" % (NAME, MATRIC))
    y -= 10
    c.setFillColor(CLIENT)
    c.drawString(M, y, "Repository: " + REPO)
    y -= 14
    c.setStrokeColor(RULE)
    c.setLineWidth(0.8)
    c.line(M, y, W - M, y)
    y -= 16

    cw = W - 2 * M

    y = heading(c, M, y, "1.  Project goal and store type")
    y = para(c, M, y, (
        "<b>Declutter</b> is an escrow-mediated peer-to-peer resale marketplace for used goods, spanning six "
        "categories: electronics, furniture, appliances, fashion, books and other. Every listing is a unique "
        "second-hand item rather than stock of a product line."
        "<br/><br/>"
        "Informal resale depends on strangers exchanging money and meeting in person with no intermediary, which "
        "produces a familiar set of failures: buyers pay for items that never materialise, sellers travel to meet "
        "buyers who never intended to purchase, and contact details are exposed early and cannot be withdrawn. "
        "Declutter inserts a verified, publicly identified intermediary between the two parties. Listings are "
        "curated before publication, payment passes through the platform rather than between the parties, "
        "communication is mediated, and physical handover is gated by a payment-proof PIN. The guiding principle "
        "is that <b>neither party needs to trust the other, only the intermediary</b>."
        "<br/><br/>"
        "The model was chosen for its academic value as well as its product logic. It requires a non-trivial item "
        "state machine and role-based access control, exercising more of the full-stack syllabus than a "
        "conventional product catalogue would."), cw)

    y = heading(c, M, y, "2.  Features to be implemented")
    y = para(c, M, y, (
        "<b>Curated listings.</b> Sellers submit an item and the amount they wish to receive. The admin reviews, "
        "edits the presentation, sets the public price, and publishes or rejects with a reason. The margin between "
        "the seller's payout and the listed price is the platform's revenue, and the two figures are stored "
        "independently so the payout obligation never drifts.<br/>"
        "<b>Marketplace.</b> Responsive product grid with category filtering and price sorting, product detail "
        "pages with an image gallery, and a cart that persists across pages and marks items unavailable once sold.<br/>"
        "<b>Escrow checkout.</b> A 10% deposit places an item on hold for 72 hours, and the balance is paid "
        "on-platform before travel. Payment is simulated, since the brief does not require real processing, but it "
        "drives the same state transitions a live gateway webhook would.<br/>"
        "<b>Anonymised relay.</b> Before a deposit the parties cannot reach each other. Buyers submit information "
        "requests that reach the seller as platform enquiries with no identity attached, and the admin relays or "
        "withholds responses. After a deposit a direct thread opens and contact details are disclosed.<br/>"
        "<b>PIN handover.</b> On full payment a single-use PIN is issued to the buyer and stored only as a hash. "
        "At the meeting the seller enters it, and valid entry proves funds cleared and releases the payout.<br/>"
        "<b>Meetup agreement.</b> Either party drops a pin on an embedded Leaflet map within the direct thread, "
        "biased toward public locations."), cw)

    y = heading(c, M, y, "3.  Technology stack")
    rows = [
        ("Frontend", "React 19 / Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui"),
        ("Client-side scripting", "Fetch API against JSON route handlers: cart badge, category filter, thread polling"),
        ("Backend", "Next.js route handlers, server-side role guards, Zod validation at every boundary"),
        ("Database", "PostgreSQL (local instance), accessed through Prisma ORM with versioned migrations"),
        ("Authentication", "NextAuth, credentials provider, bcrypt password hashing"),
        ("Libraries", "Leaflet + OpenStreetMap (maps), Vitest (testing), bcrypt (PIN and password hashing)"),
    ]
    for label, val in rows:
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 8.2)
        c.drawString(M + 2, y, label)
        c.setFillColor(INK)
        c.setFont("Helvetica", 8.2)
        c.drawString(M + 108, y, val)
        y -= 11.5
    y -= 2
    para(c, M, y, (
        "The stack requires no paid service, hosted provider or API key. The application runs from a clone against "
        "a local PostgreSQL instance, which keeps the submission reproducible by an assessor. Payment, SMS "
        "verification, seller payout and hold expiry are deliberately simulated for the same reason."), cw, small)


# ================================================================ PAGE TWO ===
def page_two(c):
    cw = W - 2 * M
    y = H - M
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(M, y - 4, "4.  Architecture and data flow")
    y -= 18

    y = para(c, M, y, (
        "A browser request reaches a Next.js route handler, which applies a server-side role guard, validates input "
        "with Zod, and queries PostgreSQL through Prisma. Pages are server-rendered, while the interactive elements "
        "(cart badge, category filter and message polling) exchange JSON with the same route handlers via the Fetch "
        "API. Prices and totals are always recalculated on the server and never accepted from the client, "
        "preventing price manipulation."), cw, small)

    h = draw_architecture(c, M, y - 10, cw)
    y = y - 10 - h - 12
    y = para(c, M, y, (
        "Dashed components are external or stubbed. Payment, SMS verification and payout are simulated endpoints "
        "that drive the same state transitions a live gateway webhook would trigger."), cw, tiny)

    y = section(c, M, y, "5.  Item lifecycle")
    y = para(c, M, y, (
        "Every listing moves through a single state machine that governs what each role may do with it. This is the "
        "core of the application logic and its main source of complexity."), cw, small)

    h = draw_state_machine(c, M, y - 10, cw)
    y = y - 10 - h - 16
    y = para(c, M, y, (
        "Only one active order may exist per item at any time, enforced by a partial unique index rather than by "
        "application code alone. Items in <b>sold</b> or <b>completed</b> are withdrawn from the public marketplace "
        "and display as unavailable in any cart still holding them."), cw, tiny)

    y = section(c, M, y, "6.  Development approach")
    y = para(c, M, y, (
        "The application is built as <b>vertical slices in the order of the acceptance criteria</b>: register, "
        "submit, approve, enquire, deposit, converse, agree a meetup, pay the balance, redeem the PIN, record the "
        "payout. A working end-to-end demonstration therefore exists from the first slice onward rather than only "
        "at the end. Each slice is developed <b>test-first with Vitest</b>, writing a failing test, then the "
        "implementation, then refactoring. Tests concentrate on the invariants that are hard to verify by clicking: "
        "legal state transitions, one active order per item, single-use PIN redemption, server-side price "
        "authority, and role guards returning 403. The eleven-step operator walkthrough serves as the acceptance "
        "checklist. Each slice is developed on its own short-lived branch and merged non-fast-forward, so the "
        "commit history shows each feature as a discrete unit."), cw, small)
    para(c, M, y, (
        "<b>Simulated for this submission:</b> payment authorisation, SMS verification codes, seller payouts, and "
        "hold expiry (evaluated on read rather than by a scheduled job). Each drives the same state transitions its "
        "real counterpart would. <b>Deferred:</b> dispute resolution, ratings and reputation, fraud detection, "
        "search ranking, and courier handover, all specified in the companion product document and reported as "
        "future work."), cw, small)


# ================================================================ ERD PAGE ===
ENTITIES = [
    ("users", ["id  PK", "role  buyer/seller/admin", "email  unique", "phone", "phone_verified",
               "password_hash", "first_name", "created_at"]),
    ("items", ["id  PK", "seller_id  FK users", "title, description", "category, condition",
               "seller_payout_amount", "listed_price", "status", "approved_by  FK / created_at"]),
    ("item_images", ["id  PK", "item_id  FK items", "url", "sort_order"]),
    ("orders", ["id  PK", "item_id  FK items", "buyer_id  FK users", "deposit_amount",
                "balance_amount / status", "pin_hash, pin_issued_at", "pin_redeemed_at",
                "hold_expires_at", "meetup_lat/lng/label"]),
    ("threads", ["id  PK", "item_id  FK items", "order_id  FK orders", "thread_type  relay/direct",
                 "status  open/locked", "locked_reason, locked_at"]),
    ("messages", ["id  PK", "thread_id  FK threads", "sender_id  FK users", "body",
                  "visible_to", "created_at"]),
    ("payouts", ["id  PK", "order_id  FK orders", "admin_id  FK users", "amount", "status", "paid_at"]),
]


def draw_erd(c, x0, top, cw):
    """Entity relationship diagram. Returns the height consumed."""
    ew = 4.95 * cm
    gap = (cw - 3 * ew) / 2
    HDR, PAD_TOP, LINE, PAD_BOT = 0.56 * cm, 0.30 * cm, 0.335 * cm, 0.22 * cm

    def entity(x, t, name, fields):
        h = HDR + PAD_TOP + len(fields) * LINE + PAD_BOT
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1)
        c.setFillColor(ACCENT)
        c.roundRect(x, t - HDR, ew, HDR, 2, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 8.4)
        c.drawString(x + 6, t - 0.40 * cm, name)
        c.setFillColor(colors.white)
        c.setStrokeColor(RULE)
        c.rect(x, t - h, ew, h - HDR, stroke=1, fill=1)
        fy = t - HDR - PAD_TOP - 4
        for f in fields:
            bold = "PK" in f or "FK" in f
            c.setFont("Helvetica-Bold" if bold else "Helvetica", 6.8)
            c.setFillColor(INK if bold else MUTED)
            c.drawString(x + 6, fy, f)
            fy -= LINE
        return h

    def link(x1, y1, x2, y2, card):
        c.saveState()
        c.setStrokeColor(ACCENT)
        c.setLineWidth(0.9)
        c.line(x1, y1, x2, y2)
        c.restoreState()
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 6.0)
        c.drawCentredString((x1 + x2) / 2, (y1 + y2) / 2 + 2.5, card)

    xs = [x0 + i * (ew + gap) for i in range(3)]
    h1 = [entity(xs[i], top, *ENTITIES[i]) for i in range(3)]
    row2 = top - max(h1) - 1.35 * cm
    h2 = [entity(xs[i], row2, *ENTITIES[3 + i]) for i in range(3)]
    row3 = row2 - max(h2) - 1.35 * cm
    h3 = entity(xs[0], row3, *ENTITIES[6])

    m1 = top - max(h1) / 2
    m2 = row2 - max(h2) / 2
    link(xs[0] + ew, m1, xs[1], m1, "1:N")
    link(xs[1] + ew, m1, xs[2], m1, "1:N")
    link(xs[0] + ew, m2, xs[1], m2, "1:0..1")
    link(xs[1] + ew, m2, xs[2], m2, "1:N")
    link(xs[0] + ew * 0.5, top - max(h1), xs[0] + ew * 0.5, row2, "1:N")
    link(xs[0] + ew * 0.5, row2 - max(h2), xs[0] + ew * 0.5, row3, "1:0..1")
    link(xs[1] + ew * 0.25, top - max(h1), xs[0] + ew * 0.88, row2, "1:0..1")

    return top - (row3 - h3)


def erd(c):
    y = H - M
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(M, y - 4, "Declutter: Entity Relationship Diagram")
    y -= 19
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.6)
    c.drawString(M, y, "Portfolio Phase 1 (Conception)  ·  %s" % COURSE)
    y -= 9.5
    c.drawString(M, y, "Name: %s   ·   Matriculation number: %s" % (NAME, MATRIC))
    y -= 12
    c.setStrokeColor(RULE)
    c.line(M, y, W - M, y)
    y -= 14

    cw = W - 2 * M
    h = draw_erd(c, M, y, cw)
    yy = y - h - 1.0 * cm

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8.4)
    c.drawString(M, yy, "Relationships not drawn above")
    yy -= 12
    rels = [
        "1:N   users to messages (sender)        1:N   users to payouts (admin, one platform operator)",
        "1:N   items to threads (relay threads exist before any order)",
        "An item has at most one active order at a time, enforced by a partial unique index on",
        "orders(item_id) over non-terminal statuses, not by application code alone.",
    ]
    c.setFont("Helvetica", 7.2)
    c.setFillColor(MUTED)
    for r in rels:
        c.drawString(M, yy, r)
        yy -= 10

    yy -= 6
    notes = Paragraph(
        "<b>Design notes.</b> There is no <i>order_items</i> join table: each listing is a unique single item, so an "
        "order references exactly one item and a cart holding three items produces three separate orders, because "
        "quantity is meaningless when every row of stock is unique. <i>seller_payout_amount</i> and "
        "<i>listed_price</i> are stored independently so the payout obligation is never derived from a percentage "
        "and never drifts. <i>messages.visible_to</i> enables the anonymised relay without requiring a second "
        "messaging table. <i>item_images</i> is normalised rather than an array column so the admin can reorder and "
        "remove individual images while curating a listing. The PIN is stored only as a bcrypt hash.",
        tiny)
    _, nh = notes.wrap(cw, 200)
    notes.drawOn(c, M, yy - nh)


def main():
    c = canvas.Canvas("%s.pdf" % STEM, pagesize=A4)
    c.setTitle("Declutter: Concept Document")
    c.setAuthor(NAME)
    page_one(c)
    c.showPage()
    page_two(c)
    c.showPage()
    c.save()

    c = canvas.Canvas("%s_ERD.pdf" % STEM, pagesize=A4)
    c.setTitle("Declutter: Entity Relationship Diagram")
    c.setAuthor(NAME)
    erd(c)
    c.showPage()
    c.save()
    print("wrote %s.pdf (2 pages) and %s_ERD.pdf (1 page)" % (STEM, STEM))


if __name__ == "__main__":
    main()
