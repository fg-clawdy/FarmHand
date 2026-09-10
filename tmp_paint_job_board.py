"""Inpaint corkboard corner fasteners and redraw paper-only Wanted flyers."""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
CORK = ROOT / "apps/player/public/art/painted/farm/corkboard.png"
SHEET = ROOT / "apps/player/public/art/painted/farm/wanted_poster_sheet.png"

FASTENERS = ((125, 113), (569, 149), (131, 431), (557, 485))
CELL_W, CELL_H = 315, 470
INSET = (28, 20, 258, 386)
PAPER_W, PAPER_H = INSET[2], INSET[3]


def load_font(size: int):
    for name in ("georgiab.ttf", "georgia.ttf", "timesbd.ttf", "times.ttf", "arialbd.ttf"):
        path = Path(r"C:\Windows\Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def luma(p):
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def inpaint_spot(im, cx, cy, radius=22):
    pix = im.load()
    w, h = im.size
    vx, vy = 360 - cx, 300 - cy
    vlen = math.hypot(vx, vy) or 1
    sx = int(cx + 50 * vx / vlen)
    sy = int(cy + 50 * vy / vlen)
    rng = random.Random(cx * 10007 + cy)
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if not (0 <= x < w and 0 <= y < h):
                continue
            d = math.hypot(x - cx, y - cy)
            if d > radius:
                continue
            ox = sx + (x - cx) + rng.randint(-1, 1)
            oy = sy + (y - cy) + rng.randint(-1, 1)
            ox = max(0, min(w - 1, ox))
            oy = max(0, min(h - 1, oy))
            src = pix[ox, oy]
            n = rng.randint(-4, 4)
            fill = (
                max(0, min(255, src[0] + n)),
                max(0, min(255, src[1] + n)),
                max(0, min(255, src[2] + n // 2)),
                src[3],
            )
            t = 1.0 if d < radius - 5 else (radius - d) / 5.0
            t *= t * (3 - 2 * t)
            dst = pix[x, y]
            pix[x, y] = tuple(int(dst[i] * (1 - t) + fill[i] * t) for i in range(4))


def nibble_mask(w, h, rng, tear=None):
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    pad = 10
    pts = []
    x = pad
    pts.append((x, pad + rng.randint(-2, 3)))
    while x < w - pad:
        x += rng.randint(10, 22)
        pts.append((min(w - pad, x), max(4, pad + rng.randint(-3, 4))))
    y = pad
    while y < h - pad:
        y += rng.randint(10, 22)
        jag = rng.randint(-4, 5)
        if tear == "br" and y > h * 0.45:
            jag -= rng.randint(8, 28)
        pts.append((max(w // 2, w - pad + jag), min(h - 6, y)))
    x = w - pad
    while x > pad:
        x -= rng.randint(10, 22)
        jag = rng.randint(-4, 4)
        if tear == "br" and x > w * 0.42:
            jag += rng.randint(10, 36)
        pts.append((max(6, x), min(h - 5, h - pad + jag)))
    y = h - pad
    while y > pad:
        y -= rng.randint(10, 22)
        pts.append((max(5, pad + rng.randint(-3, 4)), max(5, y)))
    d.polygon(pts, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(0.6))


def paper_texture(w, h, rng, warmer=False):
    base = (236, 214, 164, 255) if not warmer else (232, 196, 148, 255)
    im = Image.new("RGBA", (w, h), base)
    pix = im.load()
    for y in range(h):
        for x in range(w):
            n = rng.randint(-14, 12)
            fiber = 6 if rng.random() < 0.04 else 0
            pix[x, y] = (
                max(0, min(255, base[0] + n + fiber)),
                max(0, min(255, base[1] + n - 2)),
                max(0, min(255, base[2] + n // 2 - 4)),
                255,
            )
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for _ in range(14):
        cx, cy = rng.randint(0, w), rng.randint(0, h)
        rw, rh = rng.randint(18, 70), rng.randint(12, 48)
        col = (rng.randint(90, 140), rng.randint(50, 80), rng.randint(20, 40), rng.randint(18, 40))
        od.ellipse((cx - rw, cy - rh, cx + rw, cy + rh), fill=col)
    im = Image.alpha_composite(im, overlay)
    burn = Image.new("L", (w, h), 0)
    ImageDraw.Draw(burn).rectangle((0, 0, w - 1, h - 1), outline=90, width=18)
    burn = burn.filter(ImageFilter.GaussianBlur(10))
    pix = im.load()
    bp = burn.load()
    for y in range(h):
        for x in range(w):
            t = bp[x, y] / 255.0 * 0.22
            r, g, b, a = pix[x, y]
            pix[x, y] = (int(r * (1 - t)), int(g * (1 - t * 1.1)), int(b * (1 - t * 1.2)), a)
    return im


def draw_border(d, w, h, ink):
    d.rectangle((18, 18, w - 19, h - 19), outline=ink, width=3)
    d.rectangle((26, 26, w - 27, h - 27), outline=ink, width=1)


def draw_wanted(d, cx, y, font):
    text = "WANTED"
    gap = 7
    widths = [d.textbbox((0, 0), ch, font=font)[2] for ch in text]
    total = sum(widths) + gap * (len(text) - 1)
    x = cx - total / 2
    ink = (42, 18, 10, 255)
    stroke = (28, 12, 8, 255)
    for ch, tw in zip(text, widths):
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if dx * dx + dy * dy <= 5:
                    d.text((x + dx, y + dy), ch, font=font, fill=stroke)
        d.text((x, y), ch, font=font, fill=ink)
        x += tw + gap


def draw_rules(d, w, y, ink):
    d.line((48, y, w - 48, y), fill=ink, width=2)
    d.line((56, y + 6, w - 56, y + 6), fill=ink, width=1)
    mx = w // 2
    d.polygon([(mx, y - 5), (mx + 7, y + 3), (mx, y + 11), (mx - 7, y + 3)], fill=ink)


def draw_pin(im, x, y):
    d = ImageDraw.Draw(im)
    d.ellipse((x - 7, y - 4, x + 9, y + 8), fill=(40, 22, 14, 90))
    d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(86, 48, 28, 255))
    d.ellipse((x - 3, y - 4, x + 2, y + 1), fill=(210, 170, 110, 220))

def make_paper(mode):
    scale = 2
    w, h = PAPER_W * scale, PAPER_H * scale
    rng = random.Random({"pinned": 11, "tearing": 22, "empty": 33, "pinning": 44}[mode])
    if mode == "empty":
        return Image.new("RGBA", (PAPER_W, PAPER_H), (0, 0, 0, 0))
    paper = paper_texture(w, h, rng, warmer=mode == "tearing")
    d = ImageDraw.Draw(paper)
    ink = (48, 22, 12, 230)
    draw_border(d, w, h, ink)
    draw_wanted(d, w // 2, 70, load_font(78))
    draw_rules(d, w, 168, ink)
    d.line((64, h - 88, w - 64, h - 88), fill=ink, width=1)
    mask = nibble_mask(w, h, rng, tear="br" if mode == "tearing" else None)
    paper.putalpha(ImageChops.multiply(paper.split()[3], mask))
    out = paper
    if mode == "tearing":
        out = paper.rotate(-11, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(0, 0, 0, 0), center=(w // 2, 36))
    elif mode == "pinning":
        rotated = paper.rotate(3, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(0, 0, 0, 0), center=(w // 2, 40))
        pad = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
        shrunk = rotated.resize((int(w * 0.96), int(h * 0.96)), Image.Resampling.LANCZOS)
        pad.paste(shrunk, ((w - shrunk.size[0]) // 2, 8), shrunk)
        out = pad
    out = out.resize((PAPER_W, PAPER_H), Image.Resampling.LANCZOS)
    draw_pin(out, PAPER_W // 2, 14 if mode != "pinning" else 10)
    sp = out.split()[3].filter(ImageFilter.GaussianBlur(3))
    sh = Image.new("RGBA", (PAPER_W, PAPER_H), (42, 22, 10, 70))
    sh.putalpha(sp)
    canvas = Image.new("RGBA", (PAPER_W, PAPER_H), (0, 0, 0, 0))
    canvas.paste(sh, (3, 4), sh)
    return Image.alpha_composite(canvas, out)


def paint_corkboard():
    im = Image.open(CORK).convert("RGBA")
    assert im.size == (721, 814), im.size
    for cx, cy in FASTENERS:
        inpaint_spot(im, cx, cy, radius=24)
    im.save(CORK)
    pix = im.load()
    print("cork fasteners after", [(cx, cy, round(luma(pix[cx, cy]), 1)) for cx, cy in FASTENERS])


def paint_sheet():
    sheet = Image.new("RGBA", (CELL_W * 4, CELL_H), (0, 0, 0, 0))
    for i, mode in enumerate(("pinned", "tearing", "empty", "pinning")):
        paper = make_paper(mode)
        cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        cell.paste(paper, (INSET[0], INSET[1]), paper)
        sheet.paste(cell, (i * CELL_W, 0), cell)
    sheet.save(SHEET)
    extrema = sheet.crop((CELL_W * 2, 0, CELL_W * 3, CELL_H)).getextrema()
    print("sheet", sheet.size, "frame2 extrema", extrema)


if __name__ == "__main__":
    paint_corkboard()
    paint_sheet()


