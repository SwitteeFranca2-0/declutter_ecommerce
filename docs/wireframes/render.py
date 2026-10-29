"""Write the wireframe pages and render each to PNG at desktop and phone width.

    python3 docs/wireframes/render.py

Needs Google Chrome and Pillow. The pages are plain HTML sharing pages/wireframe.css,
so they also open directly in a browser.
"""
import os
import subprocess

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, "pages")
PNG = os.path.join(HERE, "png")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

X = ('<svg viewBox="0 0 100 100" preserveAspectRatio="none">'
     '<line x1="0" y1="0" x2="100" y2="100" stroke="#c4c4c4" stroke-width="0.6" vector-effect="non-scaling-stroke"/>'
     '<line x1="100" y1="0" x2="0" y2="100" stroke="#c4c4c4" stroke-width="0.6" vector-effect="non-scaling-stroke"/></svg>')
BAG = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" '
       'stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>'
       '<path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>')
ALERT = ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
         'style="flex:none;margin-top:2px"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>')


def ph(cls="", style=""):
    return f'<div class="ph {cls}" style="{style}">{X}</div>'


def page(title, body, badge="2", nav=True):
    orders = '<span class="wide">Orders</span>' if nav else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Declutter wireframe</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="wireframe.css">
</head>
<body>
<div class="header"><div class="in">
  <span class="logo">Declutter<small>marketplace</small></span>
  <div class="nav">{orders}<span class="cartbtn">{BAG}<span class="wide">Cart</span><span class="badge">{badge}</span></span></div>
</div></div>
<div class="main {'narrow' if title in ('Confirmation', 'Your orders') else ''}">
{body}
</div>
</body>
</html>
"""


def card(cat, cond, title, price, dep):
    return f"""<div class="card" style="overflow:hidden">{ph()}
  <div class="pad stack" style="padding:16px">
    <div><span class="eyebrow">{cat}</span> <span class="tag">{cond}</span></div>
    <div class="title">{title}</div>
    <div class="row"><span class="price">{price}</span><span class="mono small muted">{dep} deposit</span></div>
  </div></div>"""


catalogue = page("Catalogue", f"""
<h1>Marketplace</h1>
<p class="lede">Every item is checked and priced by Declutter before it appears here. A 10% deposit reserves an item while you arrange collection.</p>
<hr class="rule">
<div class="filters">
  <div class="chips">
    <span class="fchip on">All</span><span class="fchip">Electronics</span><span class="fchip">Furniture</span>
    <span class="fchip">Appliances</span><span class="fchip">Fashion</span><span class="fchip">Books</span><span class="fchip">Other</span>
  </div>
  <span class="sort"><span class="muted">Sort</span> Newest first <span class="muted">&#9662;</span></span>
</div>
<p class="mono small muted" style="margin:0 0 16px">15 ITEMS</p>
<div class="grid">
{card("Other", "Good", "Item title, single line", "&#8358;72,000", "&#8358;7,200")}
{card("Other", "Good", "Item title, up to two lines of text", "&#8358;118,000", "&#8358;11,800")}
{card("Books", "Fair", "Item title, up to two lines of text", "&#8358;16,000", "&#8358;1,600")}
{card("Books", "Good", "Item title, single line", "&#8358;9,500", "&#8358;950")}
{card("Fashion", "Good", "Item title, up to two lines of text", "&#8358;24,000", "&#8358;2,400")}
{card("Fashion", "Fair", "Item title, single line", "&#8358;18,000", "&#8358;1,800")}
</div>
""")

detail = page("Item detail", f"""
<p style="margin:0 0 24px;font-size:13px">&lsaquo;&nbsp; Back to the marketplace</p>
<div class="half">
  <div>
    {ph("hero")}
    <div style="display:flex;gap:12px;margin-top:12px">
      {ph(style="width:100px;height:70px;border:2px solid #1f1f1f")}{ph(style="width:100px;height:70px")}{ph(style="width:100px;height:70px")}
    </div>
  </div>
  <div class="stack">
    <div><span class="eyebrow">Appliances</span> <span class="tag">Good</span></div>
    <div style="font-size:24px;font-weight:600">Item title, up to two lines</div>
    <div style="font-size:30px;font-weight:600">&#8358;31,000</div>
    <div class="card pad" style="border-color:#1f1f1f">
      <div class="kv" style="font-weight:600"><span>Pay today to reserve</span><span>&#8358;3,100</span></div>
      <div class="kv muted"><span>Balance on collection</span><span class="mono">&#8358;27,900</span></div>
      <p class="small muted" style="margin:8px 0 0;line-height:1.6">A 10% deposit holds this item for 72 hours. Refund terms are shown in full before you pay.</p>
    </div>
    <span class="btn ajax">Add to cart</span>
    <div class="dashed">Declutter holds your payment until you collect. The seller's identity stays hidden until a deposit is placed.</div>
    <div style="font-weight:600;font-size:14px;margin-top:24px">Description</div>
    <div><div class="bar"></div><div class="bar"></div><div class="bar" style="width:60%"></div></div>
  </div>
</div>
""")


def cart_line(cat, title, cond, price, dep, gone=False):
    if gone:
        return f"""<div class="card line gone">{ph()}
  <div class="stack" style="--g:6px"><span class="eyebrow">{cat}</span> <span class="chip">Unavailable</span>
    <div class="title muted">{title}</div><div class="small muted">Reserved by another buyer</div></div>
  <div class="right" style="text-align:right"><div class="price strike">{price}</div>
    <div class="link ajax" style="margin-top:28px">Remove</div></div></div>"""
    return f"""<div class="card line">{ph()}
  <div class="stack"><span class="eyebrow">{cat}</span><div class="title">{title}</div><div class="small muted">Condition: {cond}</div></div>
  <div class="right" style="text-align:right"><div class="price">{price}</div><div class="mono small muted">{dep} deposit</div>
    <div class="link ajax" style="margin-top:16px">Remove</div></div></div>"""


cart = page("Cart", f"""
<h1>Your cart</h1>
<p class="lede">Prices and availability are re-checked every time this page loads.</p>
<div class="split">
  <div class="stack">
    {cart_line("Books", "Item title, up to two lines", "Fair", "&#8358;16,000", "&#8358;1,600")}
    {cart_line("Books", "Item title, single line", "Good", "&#8358;9,500", "&#8358;950")}
    {cart_line("Furniture", "Item title, single line", "", "&#8358;78,000", "", gone=True)}
  </div>
  <div class="card pad stack" style="border-color:#1e5f4b">
    <div style="font-weight:600;font-size:16px">Summary</div>
    <div><div class="kv"><span class="muted">2 items available</span><span class="mono">&#8358;25,500</span></div>
    <div class="kv"><span class="muted">1 item unavailable</span><span class="mono muted">not included</span></div></div>
    <hr class="rule" style="margin:0">
    <div><div class="kv" style="font-weight:600"><span>Deposit due today</span><span style="font-size:20px">&#8358;2,550</span></div>
    <div class="kv muted"><span>Balance on collection</span><span class="mono">&#8358;22,950</span></div></div>
    <span class="btn">Proceed to checkout</span>
    <p class="small muted" style="margin:12px 0 0;line-height:1.6">Each item becomes its own order. Unavailable items are never charged for.</p>
  </div>
</div>
""")

TERMS = [("You inspect the item and decide not to buy", "Deposit refunded in full, less a small administrative fee"),
         ("You do not attend the handover", "Half the deposit is kept, half is refunded"),
         ("The 72-hour hold runs out", "Deposit refunded in full"),
         ("The seller does not attend", "Deposit refunded in full")]
rows = "".join(f"<tr><td>{a}</td><td>{b}</td></tr>" for a, b in TERMS)
summary = """<div class="card pad stack">
    <div style="font-weight:600;font-size:16px">Order summary</div>
    <div><div class="kv"><span>Item title, up to two lines</span><span class="mono muted">&#8358;16,000</span></div>
    <div class="kv"><span>Item title, single line</span><span class="mono muted">&#8358;9,500</span></div></div>
    <hr class="rule" style="margin:0">
    <div><div class="kv" style="font-weight:600"><span>Deposit due today</span><span style="font-size:20px">&#8358;2,550</span></div>
    <div class="kv muted"><span>Balance before collection</span><span class="mono">&#8358;22,950</span></div></div>
    <p class="small muted" style="margin:12px 0 0;line-height:1.6">Each item becomes its own order with its own reference. Amounts are recalculated by the server when you pay.</p>
  </div>"""
checkout = page("Checkout", f"""
<h1>Pay deposit</h1>
<p class="lede">Read the refund terms, then reserve your items with a 10% deposit.</p>
<div class="split">
  <div class="stack">
    <div class="notice" style="display:flex;gap:10px">{ALERT}<span><b>Simulated payment.</b> This is a course prototype. No card is requested and no money moves: pressing pay records the deposit exactly as a real payment confirmation would.</span></div>
    <div style="font-weight:600;font-size:16px;margin-top:24px">Deposit and refund terms</div>
    <p class="lede" style="margin:8px 0 0">Your deposit is 10% of each item's price and holds it for you for 72 hours. The balance is paid before collection. If the handover does not go ahead:</p>
    <div class="card"><table class="terms">{rows}</table></div>
    <div class="check" style="margin-top:20px"><span class="box"></span>I have read the deposit and refund terms and accept them.</div>
    <span class="btn ajax disabled" style="margin-top:24px">Pay &#8358;2,550 deposit (simulated)</span>
  </div>
  {summary}
</div>
""")


def order(ref, price, dep, bal):
    return f"""<div class="card order">{ph()}
  <div><div class="small muted mono">Order <span style="color:#1f1f1f">{ref}</span></div>
    <div class="title" style="margin:6px 0 10px">Item title, up to two lines</div>
    <div class="kv"><span class="muted">Price</span><span class="mono muted">{price}</span></div>
    <div class="kv" style="font-weight:600"><span>Deposit paid</span><span>{dep}</span></div>
    <div class="kv"><span class="muted">Balance outstanding</span><span class="mono muted">{bal}</span></div>
    <div class="kv"><span class="muted">Held until</span><span class="mono muted">Sun, 1 Nov, 09:15</span></div></div></div>"""


accepted = "".join(f'<p class="lede" style="margin:0 0 8px">{a}: {b[0].lower() + b[1:]}.</p>' for a, b in TERMS)
confirmation = page("Confirmation", f"""
<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
  <span style="width:30px;height:30px;border-radius:50%;background:#1f1f1f;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:15px">&#10003;</span>
  <h1 style="margin:0">Deposit received</h1></div>
<p style="font-size:14px;margin:0 0 16px">Your 2 items are on hold for you and have left the marketplace.</p>
<div class="notice small" style="margin-bottom:20px">Simulated payment: no money moved. The orders below are real records.</div>
<div class="stack">
  {order("DCL-XXXXXXX1", "&#8358;9,500", "&#8358;950", "&#8358;8,550")}
  {order("DCL-XXXXXXX2", "&#8358;16,000", "&#8358;1,600", "&#8358;14,400")}
  <div class="card pad" style="border-color:#1f1f1f">
    <div class="kv" style="font-weight:600"><span>Total deposit paid</span><span style="font-size:18px">&#8358;2,550</span></div>
    <div class="kv muted"><span>Total balance outstanding</span><span class="mono">&#8358;22,950</span></div></div>
</div>
<div style="font-weight:600;font-size:15px;margin:32px 0 12px">The terms you accepted</div>
{accepted}
<div class="card pad stack" style="margin-top:28px;border-color:#1f1f1f">
  <div style="font-weight:600;font-size:15px">Keep track of this</div>
  <p class="lede" style="margin:8px 0 0">Your orders are always here, with what you paid, what is left to pay and how long each item is held.</p>
  <div class="btns"><span class="btn">DCL-XXXXXXX1</span><span class="btn">DCL-XXXXXXX2</span><span class="btn ghost">All your orders</span></div>
</div>
<p style="font-size:13px;margin-top:28px">Back to the marketplace</p>
""", badge="0")


def olist(ref, chip, money, faded=False):
    op = ' style="opacity:.6"' if faded else ""
    return f"""<div class="card olist">{ph("thumb")}
  <div{op}><div class="title">Item title, up to two lines</div>
    <div class="mono small muted only-phone" style="margin-top:4px">{ref}</div>
    <div style="margin:8px 0"><span class="chip">{chip}</span></div>
    <div style="font-size:13px">{money}</div></div>
  <div class="ref mono small muted">{ref}</div></div>"""


orders = page("Your orders", f"""
<h1>Your orders</h1>
<p class="lede">Items you have reserved with a deposit. Declutter holds your money until the handover, and each item is held for 72 hours.</p>
<div class="stack">
  {olist("DCL-XXXXXXX1", "Deposit paid, held for you", '<span class="muted">&#8358;950 paid,</span> <b>&#8358;8,550</b> on collection')}
  {olist("DCL-XXXXXXX2", "Deposit paid, held for you", '<span class="muted">&#8358;1,600 paid,</span> <b>&#8358;14,400</b> on collection')}
  {olist("DCL-XXXXXXX3", "Hold expired", '<span class="muted">&#8358;4,900 deposit refunded</span>', faded=True)}
  {olist("DCL-XXXXXXX4", "Hold expired", '<span class="muted">&#8358;7,800 deposit refunded</span>', faded=True)}
</div>
""", badge="0")

# (file stem, html, render at phone width too)
SHOTS = [("1-catalogue", catalogue), ("2-item-detail", detail), ("3-cart", cart),
         ("4-checkout", checkout), ("5-confirmation", confirmation), ("6-orders", orders)]


def trim(path):
    im = Image.open(path).convert("RGB")
    bg = Image.new("RGB", im.size, im.getpixel((im.width - 1, im.height - 1)))
    box = ImageChops.difference(im, bg).getbbox()
    im.crop((0, 0, im.width, min(im.height, box[3] + 40))).save(path, optimize=True)


def main():
    for stem, html in SHOTS:
        src = os.path.join(PAGES, f"{stem}.html")
        with open(src, "w", encoding="utf-8") as f:
            f.write(html)
        for width, suffix in ((1280, "desktop"), (390, "phone")):
            out = os.path.join(PNG, f"{stem}-{suffix}.png")
            # Headless Chrome will not size a window below about 500px, so the phone
            # layout is rendered inside an iframe of the exact width and cropped to it.
            host = os.path.join(PAGES, f"_{stem}-{suffix}.html")
            with open(host, "w", encoding="utf-8") as f:
                f.write(f'<body style="margin:0;background:#f4f4f4"><iframe src="{stem}.html" '
                        f'style="border:0;display:block;width:{width}px;height:3600px"></iframe></body>')
            try:
                subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                                "--virtual-time-budget=4000", f"--window-size={max(width, 600)},3600",
                                f"--screenshot={out}", f"file://{host}"],
                               check=True, capture_output=True)
            finally:
                os.remove(host)
            Image.open(out).crop((0, 0, width, 3600)).save(out)
            trim(out)
            print(out)


if __name__ == "__main__":
    main()
