#!/usr/bin/env python3
"""Slice generated FarmVille-like sheets into production atlas frames."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "assets/generated-sheets"
OUT = ROOT / "apps/player/public/art/generated"


def chroma_key(im: Image.Image, t: int = 55) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if g > 90 and g > r + 35 and g > b + 35:
                px[x, y] = (r, g, b, 0)
                continue
            # green spill on edges
            if g > r + 18 and g > b + 18:
                ng = min(g, max(r, b) + 12)
                px[x, y] = (r, ng, b, a)
    return rgba


def black_key(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r + g + b < 28:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def fit(im: Image.Image, dw: int, dh: int, bottom: bool = True) -> Image.Image:
    out = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    scale = min(dw / max(1, im.width), dh / max(1, im.height))
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (dw - nw) // 2
    y = dh - nh if bottom else (dh - nh) // 2
    out.alpha_composite(resized, (x, max(0, y)))
    return out


def cells(im: Image.Image, cols: int, rows: int, inset: float = 0.06) -> list[Image.Image]:
    cw, ch = im.width / cols, im.height / rows
    ix, iy = cw * inset, ch * inset
    out = []
    for row in range(rows):
        for col in range(cols):
            box = (
                int(col * cw + ix),
                int(row * ch + iy),
                int((col + 1) * cw - ix),
                int((row + 1) * ch - iy),
            )
            out.append(im.crop(box))
    return out


def save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")


def interpolate_bob(still: Image.Image, n: int, amount: float, dip: bool = False) -> list[Image.Image]:
    frames = []
    w, h = still.size
    for i in range(n):
        t = (i / max(1, n)) * math.pi * 2
        bob = abs(math.sin(t)) * amount
        if dip:
            bob = amount * 0.55 + math.sin(t) * amount * 0.35
        canvas = Image.new("RGBA", (w, h + int(amount) + 4), (0, 0, 0, 0))
        canvas.alpha_composite(still, (0, int(bob) + 2))
        frames.append(canvas)
    return frames


def main() -> None:
    crops = chroma_key(Image.open(SHEETS / "sheet_crops_chroma.png"))
    crop_kinds = ["daisy", "herbs", "sunflower", "oak"]
    for i, cell in enumerate(cells(crops, 4, 4)):
        kind = crop_kinds[i // 4]
        stage = (i % 4) + 1
        save(fit(trim(cell), 160, 220), OUT / "crops" / f"{kind}_{stage}.png")

    animals = chroma_key(Image.open(SHEETS / "sheet_animals_chroma.png"))
    kinds = ["cow", "chicken", "pig", "sheep", "horse"]
    actions = ["sit", "lay", "walk", "run", "eat"]
    for i, cell in enumerate(cells(animals, 5, 5)):
        kind = kinds[i // 5]
        action = actions[i % 5]
        still = fit(trim(cell, 4), 180, 180, bottom=True)
        save(still, OUT / "animals" / f"{kind}_{action}.png")
        if action in ("walk", "run"):
            amt = 7 if action == "walk" else 10
            for fi, fr in enumerate(interpolate_bob(still, 6, amt)):
                save(fr, OUT / "animals" / f"{kind}_{action}_{fi}.png")
        elif action == "eat":
            for fi, fr in enumerate(interpolate_bob(still, 6, 6, dip=True)):
                save(fr, OUT / "animals" / f"{kind}_{action}_{fi}.png")
        else:
            for fi, fr in enumerate(interpolate_bob(still, 4, 2.2)):
                save(fr, OUT / "animals" / f"{kind}_{action}_{fi}.png")

    buildings = chroma_key(Image.open(SHEETS / "sheet_buildings_chroma.png"))
    halves = cells(buildings, 2, 1)
    save(fit(trim(halves[0]), 420, 420), OUT / "buildings" / "barn.png")
    save(fit(trim(halves[1]), 420, 420), OUT / "buildings" / "store.png")

    fence = chroma_key(Image.open(SHEETS / "sheet_fence_chroma.png"))
    fhalves = cells(fence, 2, 1)
    save(fit(trim(fhalves[0]), 128, 256), OUT / "fence" / "sw.png")
    save(fit(trim(fhalves[1]), 128, 256), OUT / "fence" / "se.png")

    props = chroma_key(Image.open(SHEETS / "sheet_props_chroma.png"))
    prop_names = [
        "bales_stacked",
        "hay",
        "crate",
        "sack",
        "barrel",
        "sign",
        "can",
        "beaker",
        "acorn",
        "bush",
        "ladder",
        "dirt_mound",
    ]
    for name, cell in zip(prop_names, cells(props, 4, 3)):
        size = 200 if name in ("can", "beaker", "acorn", "sign") else 220
        save(fit(trim(cell), size, size, bottom=True), OUT / "props" / f"{name}.png")

    tiles = black_key(Image.open(SHEETS / "sheet_tiles.png"))
    tile_names = ["grass", "dirt", "farmland", "path"]
    for name, cell in zip(tile_names, cells(tiles, 2, 2)):
        save(fit(trim(cell, 2), 128, 256), OUT / "tiles" / f"{name}.png")

    hills = Image.open(SHEETS / "backdrop_hills.png").convert("RGB")
    dest = OUT / "backdrop" / "hills.jpg"
    dest.parent.mkdir(parents=True, exist_ok=True)
    hills.save(dest, "JPEG", quality=86)

    print("sliced into", OUT)


if __name__ == "__main__":
    main()
