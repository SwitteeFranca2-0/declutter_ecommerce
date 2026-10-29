#!/usr/bin/env python3
"""
Generates Uvere-Franca_92134098_WebProgramming_P1_S.pdf so that it mirrors
U1.docx exactly: same text, same section order, same three diagram images
(extracted from the docx into docs/diagrams/u1_*.png), same heading rules.

Uses platypus rather than manual canvas placement so the content flows and
paginates on its own, which matters now that the ERD is section 7 of the same
document rather than a separate file.

Run:  python3 docs/generate_p1_pdf.py
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image,
                                Table, TableStyle, HRFlowable, KeepTogether)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIAG = os.path.join(HERE, "diagrams")
OUT = os.path.join(ROOT, "Uvere-Franca_92134098_WebProgramming_P1_S.pdf")

NAME = "Franca Uvere"
MATRIC = "92134098"
COURSE = "DLBITPEWP01_E, Project: Getting Started in Web Programming"
REPO = "https://github.com/SwitteeFranca2-0/declutter_ecommerce"

INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#5A5A5A")
RULE = colors.HexColor("#D4D4D4")
ACCENT = colors.HexColor("#1E5F4B")
FILL = colors.HexColor("#F2F5F4")
LINK = colors.HexColor("#2C5F8A")

M = 2 * cm
CW = A4[0] - 2 * M

title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=16,
                       leading=19, textColor=INK, spaceAfter=8)
meta = ParagraphStyle("meta", fontName="Helvetica", fontSize=8, leading=11,
                      textColor=MUTED)
metalink = ParagraphStyle("metalink", parent=meta, textColor=LINK)
head = ParagraphStyle("head", fontName="Helvetica-Bold", fontSize=10.5,
                      leading=13, textColor=ACCENT, spaceBefore=14, spaceAfter=5)
body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.2, leading=13.2,
                      textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6)
small = ParagraphStyle("small", parent=body, fontSize=8.2, leading=11.4)
tiny = ParagraphStyle("tiny", parent=body, fontSize=7.2, leading=9.4,
                      textColor=MUTED, alignment=0)


def rule(thickness=0.5, before=3, after=9):
    return HRFlowable(width="100%", thickness=thickness, color=RULE,
                      spaceBefore=before, spaceAfter=after)


def heading(text):
    """Section heading. No rule beneath it: spacing alone separates sections."""
    return [Paragraph(text, head)]


# The ERD is scaled down so that section 7 fits on page two rather than
# spilling onto a third page. 15.5cm is the measured ceiling; 15.2cm leaves a
# small buffer so a minor text edit cannot tip the document onto a third page.
# Override with ERD_W (in cm) when tuning.
ERD_WIDTH = float(os.environ.get("ERD_W", "15.2")) * cm


def picture(filename, width=None):
    from PIL import Image as PILImage
    path = os.path.join(DIAG, filename)
    w, h = PILImage.open(path).size
    width = width or CW
    img = Image(path, width=width, height=width * h / w)
    img.hAlign = "CENTER"
    return img


STACK = [
    ("Frontend", "React 19 / Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui"),
    ("Client-side scripting", "Fetch API against JSON route handlers: cart badge, category filter, thread polling"),
    ("Backend", "Next.js route handlers, server-side role guards, Zod validation at every boundary"),
    ("Database", "PostgreSQL (local instance), accessed through Prisma ORM with versioned migrations"),
    ("Authentication", "NextAuth, credentials provider, bcrypt password hashing"),
    ("Libraries", "Leaflet + OpenStreetMap (maps), Vitest (testing), bcrypt (PIN and password hashing)"),
]

lbl = ParagraphStyle("lbl", fontName="Helvetica-Bold", fontSize=8.2, leading=11,
                     textColor=ACCENT)
val = ParagraphStyle("val", fontName="Helvetica", fontSize=8.2, leading=11,
                     textColor=INK)


def stack_table():
    data = [[Paragraph(k, lbl), Paragraph(v, val)] for k, v in STACK]
    t = Table(data, colWidths=[4.4 * cm, CW - 4.4 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), FILL),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def build():
    story = []
    story.append(Paragraph("Declutter: Concept Document", title))
    story.append(Paragraph("Portfolio Phase 1 (Conception)  ·  " + COURSE, meta))
    story.append(Paragraph("Project type: E-Commerce Site (Task 2)", meta))
    story.append(Paragraph("Name: %s   ·   Matriculation number: %s" % (NAME, MATRIC), meta))
    story.append(Paragraph('Repository: <a href="%s">%s</a>' % (REPO, REPO), metalink))
    story.append(Spacer(1, 12))

    story += heading("1.  Project goal and store type")
    story.append(Paragraph(
        "<b>Declutter</b> is an escrow-mediated peer-to-peer resale marketplace for used goods, spanning six "
        "categories: electronics, furniture, appliances, fashion, books and other. Every listing is a unique "
        "second-hand item rather than stock of a product line.", body))
    story.append(Paragraph(
        "Informal resale depends on strangers exchanging money and meeting in person with no intermediary, which "
        "produces a familiar set of failures: buyers pay for items that never materialise, sellers travel to meet "
        "buyers who never intended to purchase, and contact details are exposed early and cannot be withdrawn. "
        "Declutter inserts a verified, publicly identified intermediary between the two parties. Listings are "
        "curated before publication, payment passes through the platform rather than between the parties, "
        "communication is mediated, and physical handover is gated by a payment-proof PIN. The guiding principle "
        "is that <b>neither party needs to trust the other, only the intermediary</b>.", body))

    story += heading("2.  Features to be implemented")
    for lead, rest in [
        ("Curated listings.", " Sellers submit an item and the amount they wish to receive. The admin reviews, "
         "edits the presentation, sets the public price, and publishes or rejects with a reason. The margin "
         "between the seller's payout and the listed price is the platform's revenue."),
        ("Marketplace.", " Responsive product grid with category filtering and price sorting, product detail "
         "pages with an image gallery, and a cart that persists across pages and marks items unavailable once sold."),
        ("Escrow checkout.", " A 10% deposit places an item on hold for 72 hours, and the balance is paid "
         "on-platform before travel. Payment is simulated for the project."),
        ("Anonymised relay.", " Before a deposit the parties cannot reach each other. Buyers submit information "
         "requests that reach the seller as platform enquiries with no identity attached, and the admin relays or "
         "withholds responses. After a deposit a direct thread opens and contact details are disclosed."),
        ("PIN handover.", " On full payment a single-use PIN is issued to the buyer and stored only as a hash. "
         "At the meeting the seller enters it, and a valid entry proves funds cleared and releases the payout."),
        ("Meetup agreement.", " Either party drops a pin on an embedded Leaflet map within the direct thread, "
         "biased toward public locations."),
    ]:
        story.append(Paragraph("<b>%s</b>%s" % (lead, rest), body))

    story += heading("3.  Technology stack")
    story.append(stack_table())

    story += heading("4.  Architecture and data flow")
    story.append(Paragraph(
        "A browser request reaches a Next.js route handler, which applies a server-side role guard, validates "
        "input with Zod, and queries PostgreSQL through Prisma. Pages are server-rendered, while the interactive "
        "elements (cart badge, category filter and message polling) exchange JSON with the same route handlers "
        "via the Fetch API. Prices and totals are always recalculated on the server and never accepted from the "
        "client, preventing price manipulation.", small))
    story.append(Spacer(1, 4))
    story.append(picture("u1_architecture.png"))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Dashed components are external or stubbed. Payment, SMS verification and payout are simulated endpoints "
        "that drive the same state transitions a live gateway webhook would trigger.", tiny))

    story += heading("5.  Item lifecycle")
    story.append(Paragraph(
        "Every listing moves through a single state machine that governs what each role may do with it. This is "
        "the core of the application logic and its main source of complexity.", small))
    story.append(Spacer(1, 4))
    story.append(picture("u1_lifecycle.png"))

    story += heading("6.  Development approach")
    story.append(Paragraph(
        "The application is built as vertical slices in the order of the acceptance criteria: register, submit, "
        "approve, enquire, deposit, converse, agree a meetup, pay the balance, redeem the PIN, record the payout. "
        "Each slice is developed using the test-driven development method. The eleven-step operator walkthrough "
        "serves as the acceptance checklist. Each slice is developed on its own short-lived branch and merged "
        "non-fast-forward, so the commit history shows each feature as a discrete unit.", small))

    # bind the heading to its diagram so it cannot orphan at a page foot
    story.append(KeepTogether(heading("7.  Entity Relationship Diagram")
                              + [Spacer(1, 2), picture("u1_erd.png", ERD_WIDTH)]))

    doc = SimpleDocTemplate(OUT, pagesize=A4,
                            leftMargin=M, rightMargin=M,
                            topMargin=M, bottomMargin=M,
                            title="Declutter: Concept Document", author=NAME)
    doc.build(story)
    print("wrote %s" % os.path.basename(OUT))


if __name__ == "__main__":
    build()
