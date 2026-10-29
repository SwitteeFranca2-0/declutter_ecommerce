#!/usr/bin/env python3
"""
Buyer page flow — browse → detail → cart → checkout → confirmation.

Requested in Phase 1 supervisor feedback: the flow annotated with what data
passes between steps and how the cart is stored. Drawn with the same helpers
and palette as the Phase 1 concept diagrams so the three phases share one
visual language.

Run:  python3 docs/export_diagrams.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib import colors
from reportlab.lib.units import cm

import generate_phase1 as g


def draw_buyer_flow(c, x0, top, cw):
    """Five pages left to right, with the data crossing each boundary below.

    Client-side steps are blue, server authority is green, storage is purple.
    The cart lane sits under the page row because localStorage is the one
    piece of state that survives navigation without touching the server.
    """
    pages = [
        ("Catalogue", ["grid of listed items", "category filter (AJAX)", "sort by price"]),
        ("Item detail", ["images, description", "condition, price", "deposit shown"]),
        ("Cart", ["prices re-read", "unavailable marked", "total shown"]),
        ("Checkout", ["terms + refund", "server recalculates", "simulated payment"]),
        ("Confirmation", ["order reference", "deposit paid", "balance due"]),
    ]
    # data that crosses each boundary, drawn on the arrow between two pages
    # data that crosses each boundary, drawn on the arrow between two pages
    hops = ["itemId", "itemIds", "itemIds", "orderIds"]

    gap = 1.25 * cm          # wide enough that a hop label never meets a box
    bw = (cw - 4 * gap) / 5
    bh = 1.62 * cm
    y = top - 0.30 * cm
    mid = y - bh / 2

    def cx(i):
        return x0 + i * (bw + gap) + bw / 2

    for i, (label, lines) in enumerate(pages):
        x = x0 + i * (bw + gap)
        colour = g.SERVER if label == "Checkout" else g.CLIENT
        g.box(c, x, y, bw, bh, label, lines, colour)
        if i < len(hops):
            g.arrow(c, x + bw + 2, mid, x + bw + gap - 2, mid,
                    label=hops[i], size=5.8)

    # --- storage lane -------------------------------------------------------
    # localStorage sits under the detail/cart span: it is the only state that
    # survives navigation without the server being involved.
    sy = y - bh - 0.82 * cm
    sh = 1.62 * cm
    sx = x0 + (bw + gap)
    sw = 2 * bw + gap

    g.box(c, sx, sy, sw, sh, "localStorage — cart",
          ["itemIds only, never prices",
           "survives navigation and tab close",
           "ordered items removed on success"],
          g.DATA, dashed=True)

    bottom = y - bh                      # bottom edge of the page row
    g.arrow(c, cx(1), bottom - 2, sx + sw * 0.25, sy + 2,
            label="add", size=5.6)
    g.arrow(c, sx + sw * 0.75, sy + 2, cx(2), bottom - 2,
            label="read", size=5.6)
    g.arrow(c, sx + sw + 2, sy - sh * 0.45, cx(3) - bw * 0.15, bottom - 2,
            label="itemIds", label_below="at checkout", size=5.6)

    # --- server authority note ---------------------------------------------
    ny = sy - sh - 0.62 * cm
    c.setStrokeColor(g.RULE)
    c.setLineWidth(0.6)
    c.line(x0, ny, x0 + cw, ny)

    c.setFillColor(g.SERVER)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawString(x0, ny - 11, "Server authority")
    c.setFillColor(g.MUTED)
    c.setFont("Helvetica", 6.6)
    notes = [
        "The client sends item identifiers and nothing else. Prices, deposit and totals are recalculated from stored values at every step;",
        "an amount in a request body is ignored. Checkout re-validates each item is still listed, then creates one order per item in a single",
        "transaction and moves each item listed → on_hold. A cart holding an unavailable item is refused before any order is written.",
    ]
    ty = ny - 21
    for ln in notes:
        c.drawString(x0, ty, ln)
        ty -= 8.4

    return ny - 21 - 8.4 * len(notes)


if __name__ == "__main__":
    import export_diagrams as ex
    os.makedirs(ex.OUT, exist_ok=True)
    ex.render("buyer_flow", draw_buyer_flow, 6.4 * cm)
