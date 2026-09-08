#!/usr/bin/env python3
"""Restore left-overflow crop scraps and pack each plant into a padded cell.

Packed 392-wide sheets stored the left of frames 2–4 in the previous cell's
right gutter. A later pass zeroed those scraps without moving the plant, which
left a hard vertical haircut (especially ripe strawberries).

Sources (git):
  ORIG_REV  — last packed soil+plant sheet (scraps still present)
  BODY_REV  — zeroed one-blob-per-cell sheet (this plant only)

New cells are equal and wide enough that every reconstructed blob has margin
on both sides. Disc centers are measured on the new cells.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ORIG_REV = "58d7d89"
BODY_REV = "e966e64"
CELL_OLD = 392
CELL_NEW = 480
CROPS = {
    "strawberry": {"h": 464, "repo": "apps/player/public/art/painted/plants/plant_strawberry_stages.png"},
    "corn": {"h": 854, "repo": "apps/player/public/art/painted/plants/plant_corn_stages.png"},
    "cotton": {"h": 623, "repo": "apps/player/public/art/painted/plants/plant_cotton_stages.png"},
}


def git_file(rev: str, rel: str) -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{rev}:{rel}"], cwd=ROOT)
    from io import BytesIO

    return Image.open(BytesIO(data)).convert("RGBA")


def collect(im: Image.Image, x0: int, x1: int, pred) -> list[tuple[int, int, tuple[int, int, int, int]]]:
    px = im.load()
    h = im.size[1]
    out: list[tuple[int, int, tuple[int, int, int, int]]] = []
    for y in range(h):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if pred(r, g, b, a, x, y):
                out.append((x, y, (r, g, b, a)))
    return out


def reconstruct(orig: Image.Image, body: Image.Image) -> list[list[tuple[int, int, tuple[int, int, int, int]]]]:
    """Body from the zeroed sheet + left scraps from the packed original.

    Packed sheets left a 392px gutter between scrap and body. Closing that
    gap is what restores a continuous left silhouette (no haircut).
    """
    h = orig.size[1]
    n = orig.size[0] // CELL_OLD
    bp = body.load()
    plants: list[list[tuple[int, int, tuple[int, int, int, int]]]] = []
    for i in range(n):
        x0 = i * CELL_OLD
        body_px = collect(body, x0, x0 + CELL_OLD, lambda r, g, b, a, x, y: a >= 20)
        scrap_px: list[tuple[int, int, tuple[int, int, int, int]]] = []
        if i > 0:
            px0 = (i - 1) * CELL_OLD
            scrap_px = collect(
                orig,
                px0,
                px0 + CELL_OLD,
                lambda r, g, b, a, x, y: a >= 20 and bp[x, y][3] < 20,
            )
        if scrap_px and body_px:
            scrap_right = max(p[0] for p in scrap_px)
            body_left = min(p[0] for p in body_px)
            # Overlap the cut so the old packing seam is not a visible wall.
            gap = body_left - scrap_right - 1
            shift = gap + 3
            if shift != 0:
                scrap_px = [(x + shift, y, rgba) for x, y, rgba in scrap_px]
        plants.append(scrap_px + body_px)
    return plants


def is_soil(r: int, g: int, b: int, a: int) -> bool:
    if a < 80:
        return False
    if r < 45 or r > 155:
        return False
    if g > r * 0.92:
        return False
    if b > r * 0.72:
        return False
    # Skip ripe berries / bright highlights.
    if r > 140 and g < 80:
        return False
    return True


def measure_disc(cell: Image.Image) -> dict:
    w, h = cell.size
    px = cell.load()
    xs: list[int] = []
    ys: list[int] = []
    # Soil disc lives in the bottom of the cell; ignore stalk/leaf browns above it.
    y_cut = max(0, h - 240)
    for y in range(y_cut, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_soil(r, g, b, a):
                xs.append(x)
                ys.append(y)
    if len(xs) < 80:
        # Fall back to lower opaque mass.
        for y in range(int(h * 0.55), h):
            for x in range(w):
                if px[x, y][3] >= 40:
                    xs.append(x)
                    ys.append(y)
    xs.sort()
    ys.sort()
    # Trim outliers (5%).
    lo = max(0, int(len(xs) * 0.05))
    hi = max(lo + 1, int(len(xs) * 0.95))
    xs = xs[lo:hi]
    ys = ys[lo:hi]
    x0, x1 = xs[0], xs[-1]
    y0, y1 = ys[0], ys[-1]
    cx = (x0 + x1) / 2
    # Geometric center of the soil oval — too low (bottom-weighted) slides
    # the painted disc above the mound UV.
    cy = (y0 + y1) / 2
    d = max(28, min(x1 - x0, int((y1 - y0) * 1.85)))
    return {"x": round(cx), "y": round(cy), "d": int(d), "bbox": [x0, y0, x1, y1]}


def restore_left_foliage(cell: Image.Image, name: str, index: int) -> Image.Image:
    """Packed sheets discarded upper-left strawberry leaves (scraps were lower-only).

    Mirror the intact right crown across the soil-disc x into transparent
    pixels so both sides of the bush read as full foliage.
    """
    if name != "strawberry" or index < 2:
        return cell
    disc = measure_disc(cell)
    w, h = cell.size
    src_img = cell.copy()
    src = src_img.load()
    out = cell.copy()
    dst = out.load()
    cx = disc["x"]
    # Down to just above the soil disc so hanging berries are included.
    y_max = min(h, max(1, int(disc["y"] - 12)))
    feather = 10
    filled = 0
    for y in range(0, min(h, y_max + feather)):
        # Fully replace the left crown so the old packing wall is not a seam.
        fade = 1.0
        if y >= y_max:
            fade = 1.0 - (y - y_max + 1) / feather
        for x in range(0, cx):
            mx = 2 * cx - x
            if mx < 0 or mx >= w:
                continue
            pix = src[mx, y]
            if fade >= 0.999:
                dst[x, y] = pix
                filled += 1
            elif pix[3] >= 20 or dst[x, y][3] >= 20:
                a = tuple(int(dst[x, y][i] * (1 - fade) + pix[i] * fade) for i in range(4))
                dst[x, y] = a
                filled += 1
    print(f"  {name} {index}: replaced left crown across x={cx} (y<{y_max}, {filled} px)")
    return out


def pack_crop(name: str, spec: dict) -> dict:
    rel = spec["repo"]
    orig = git_file(ORIG_REV, rel)
    body = git_file(BODY_REV, rel)
    plants = reconstruct(orig, body)
    h = spec["h"]
    sheet = Image.new("RGBA", (CELL_NEW * 4, h), (0, 0, 0, 0))
    discs = []
    frames = []
    for i, pixels in enumerate(plants):
        xs = [p[0] for p in pixels]
        ys = [p[1] for p in pixels]
        bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
        bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
        blob = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        bp = blob.load()
        for x, y, rgba in pixels:
            bp[x - bx0, y - by0] = rgba
        # Center horizontally; keep the original bottom so discs stay seated.
        ox = (CELL_NEW - bw) // 2
        oy = h - (orig.size[1] - by0)
        oy = max(0, min(h - bh, oy))
        sheet.paste(blob, (i * CELL_NEW + ox, oy), blob)
        cell = sheet.crop((i * CELL_NEW, 0, (i + 1) * CELL_NEW, h))
        cell = restore_left_foliage(cell, name, i)
        sheet.paste(cell, (i * CELL_NEW, 0))
        disc = measure_disc(cell)
        discs.append(disc)
        frames.append(
            {
                "i": i,
                "blob": [bw, bh],
                "paste": [ox, oy],
                "src_bbox": [bx0, by0, bx1, by1],
                "left_margin": ox,
                "right_margin": CELL_NEW - ox - bw,
                "disc": disc,
            }
        )
        print(
            f"{name} {i}: blob {bw}x{bh} margins L{ox} R{CELL_NEW - ox - bw} "
            f"disc=({disc['x']},{disc['y']}) d={disc['d']}"
        )
    out = ROOT / rel
    sheet.save(out)
    return {"kind": name, "path": rel, "cell": CELL_NEW, "height": h, "discs": discs, "frames": frames}


def annotate(name: str, spec: dict, discs: list[dict]) -> None:
    im = Image.open(ROOT / spec["repo"]).convert("RGBA")
    draw = ImageDraw.Draw(im)
    h = spec["h"]
    for i, d in enumerate(discs):
        x0 = i * CELL_NEW
        cx, cy, rad = d["x"] + x0, d["y"], d["d"] / 2
        draw.ellipse((cx - rad, cy - rad * 0.62, cx + rad, cy + rad * 0.62), outline=(0, 255, 255, 255), width=2)
        draw.line((cx - 14, cy, cx + 14, cy), fill=(255, 0, 80, 255), width=2)
        draw.line((cx, cy - 14, cx, cy + 14), fill=(255, 0, 80, 255), width=2)
        draw.rectangle((x0 + 1, 1, x0 + CELL_NEW - 2, h - 2), outline=(80, 80, 80, 180))
    dest = Path("/tmp") / f"{name}_unpacked_discs.png"
    im.save(dest)
    print("wrote", dest)


def main() -> None:
    report = {"cell": CELL_NEW, "orig": ORIG_REV, "body": BODY_REV, "crops": {}}
    for name, spec in CROPS.items():
        info = pack_crop(name, spec)
        annotate(name, spec, info["discs"])
        report["crops"][name] = {
            "discs": [{"x": d["x"], "y": d["y"], "d": d["d"]} for d in info["discs"]],
            "frames": info["frames"],
        }
    Path("/tmp/crop_unpack_report.json").write_text(json.dumps(report, indent=2))
    print("report /tmp/crop_unpack_report.json")


if __name__ == "__main__":
    main()
