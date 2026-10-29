#!/usr/bin/env python3
"""
Exports the concept-document diagrams as trimmed PNGs for the DOCX version,
reusing the drawing functions from generate_phase1.py so the two formats can
never drift apart.

Run:  python3 docs/export_diagrams.py
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from PIL import Image

import generate_phase1 as g

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diagrams")
CW = 17 * cm          # same content width as the A4 document body
PAD = 0.35 * cm


def render(name, fn, height):
    """Draw one diagram on a tightly-sized page, then rasterise and trim it."""
    pdf = os.path.join(OUT, name + ".pdf")
    page_w, page_h = CW + 2 * PAD, height + 2 * PAD
    c = canvas.Canvas(pdf, pagesize=(page_w, page_h))
    fn(c, PAD, page_h - PAD, CW)
    c.showPage()
    c.save()

    subprocess.run(["qlmanage", "-t", "-s", "2200", "-o", OUT, pdf],
                   check=True, capture_output=True)
    raw = pdf + ".png"
    im = Image.open(raw).convert("RGB")

    # trim uniform white margin
    bg = Image.new("RGB", im.size, (255, 255, 255))
    from PIL import ImageChops
    bbox = ImageChops.difference(im, bg).getbbox()
    if bbox:
        im = im.crop(bbox)
    png = os.path.join(OUT, name + ".png")
    im.save(png, "PNG")
    os.remove(raw)
    os.remove(pdf)
    print("  %-14s %d x %d" % (name, im.width, im.height))
    return png


def main():
    os.makedirs(OUT, exist_ok=True)
    render("architecture", g.draw_architecture, 4.9 * cm)
    render("lifecycle", g.draw_state_machine, 3.1 * cm)
    render("erd", g.draw_erd, 16.5 * cm)


if __name__ == "__main__":
    main()
