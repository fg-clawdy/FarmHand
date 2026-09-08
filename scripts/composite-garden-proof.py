#!/usr/bin/env python3
"""Composite crop sprites onto garden_zoom at mound UVs (Pixi-equivalent)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TW, TH = 1536, 1024
CELL = 480
INSET = 2
COVER = 176
ZOOM = 0.85

MOUNDS = [
    (430, 317),
    (768, 317),
    (1106, 317),
    (430, 541),
    (768, 541),
    (1106, 541),
    (430, 760),
    (768, 760),
    (1106, 760),
]

DISCS = {
    "corn": [(240, 763, 316), (238, 768, 312), (239, 766, 300), (231, 766, 311)],
    "strawberry": [(233, 353, 290), (233, 364, 284), (233, 380, 283), (234, 350, 310)],
    "cotton": [(238, 498, 325), (210, 504, 320), (208, 511, 307), (228, 501, 322)],
}
HEIGHT = {"corn": 854, "strawberry": 464, "cotton": 623}
SHEETS: dict[str, Image.Image] = {}


def sheet(kind: str) -> Image.Image:
    if kind not in SHEETS:
        SHEETS[kind] = Image.open(
            ROOT / f"apps/player/public/art/painted/plants/plant_{kind}_stages.png"
        ).convert("RGBA")
    return SHEETS[kind]


def frame(kind: str, stage: int) -> Image.Image:
    i = stage - 1
    h = HEIGHT[kind]
    return sheet(kind).crop((i * CELL + INSET, INSET, (i + 1) * CELL - INSET, h - INSET))


def paste_crop(canvas: Image.Image, kind: str, stage: int, mx: int, my: int, scale_mul: float = 1.0) -> None:
    fr = frame(kind, stage)
    dx, dy, d = DISCS[kind][stage - 1]
    ax = (dx - INSET) / (CELL - INSET * 2)
    ay = (dy - INSET) / (HEIGHT[kind] - INSET * 2)
    sc = (COVER / d) * scale_mul
    nw, nh = max(1, int(fr.size[0] * sc)), max(1, int(fr.size[1] * sc))
    spr = fr.resize((nw, nh), Image.Resampling.LANCZOS)
    px = int(mx - ax * nw)
    py = int(my - ay * nh)
    canvas.alpha_composite(spr, (px, py))


def camera_canvas(width: int, height: int) -> tuple[Image.Image, float, float, float]:
    cover = max(width / TW, height / TH)
    contain = min(width / TW, height / TH)
    scale = min(cover * ZOOM, contain)
    x = (width - TW * scale) / 2
    y = (height - TH * scale) / 2
    return Image.new("RGBA", (width, height), (61, 138, 50, 255)), scale, x, y


def compose(slots: list[tuple[str, int] | None], size=(1280, 800), marks=True) -> Image.Image:
    ground = Image.open(ROOT / "apps/player/public/art/painted/garden/garden_zoom_3x3.jpg").convert("RGBA")
    play = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
    play.alpha_composite(ground)
    draw = ImageDraw.Draw(play)
    for i, spec in enumerate(slots):
        mx, my = MOUNDS[i]
        if spec:
            paste_crop(play, spec[0], spec[1], mx, my)
        if marks:
            draw.line((mx - 10, my, mx + 10, my), fill=(0, 255, 255, 220), width=2)
            draw.line((mx, my - 10, mx, my + 10), fill=(0, 255, 255, 220), width=2)
    out, scale, ox, oy = camera_canvas(*size)
    scaled = play.resize((int(TW * scale), int(TH * scale)), Image.Resampling.LANCZOS)
    out.alpha_composite(scaled, (int(ox), int(oy)))
    return out.convert("RGB")


def main() -> None:
    dest = Path("/tmp/garden-proof")
    dest.mkdir(exist_ok=True)
    willow = [
        ("corn", 4),
        ("corn", 3),
        None,
        None,
        ("strawberry", 3),
        ("cotton", 2),
        ("corn", 2),
        ("strawberry", 2),
        ("corn", 4),
    ]
    compose(willow).save(dest / "willow_mix_zoom085.jpg", quality=92)
    compose([("strawberry", 4)] * 9).save(dest / "all_strawberry_ripe.jpg", quality=92)
    compose([("strawberry", 3)] * 9).save(dest / "all_strawberry_flower.jpg", quality=92)
    compose([("corn", 4)] * 9).save(dest / "all_corn_ripe.jpg", quality=92)
    # Center strawberry close-up in texture space
    play = Image.open(ROOT / "apps/player/public/art/painted/garden/garden_zoom_3x3.jpg").convert("RGBA")
    mx, my = MOUNDS[4]
    paste_crop(play, "strawberry", 4, mx, my)
    crop = play.crop((mx - 220, my - 260, mx + 220, my + 140))
    crop.convert("RGB").save(dest / "center_strawberry_ripe.jpg", quality=94)
    paste_crop(play, "strawberry", 3, mx, my)  # overwrite-ish; recrop from fresh
    play = Image.open(ROOT / "apps/player/public/art/painted/garden/garden_zoom_3x3.jpg").convert("RGBA")
    paste_crop(play, "strawberry", 3, mx, my)
    play.crop((mx - 200, my - 240, mx + 200, my + 130)).convert("RGB").save(
        dest / "center_strawberry_flower.jpg", quality=94
    )
    print("wrote", dest)


if __name__ == "__main__":
    main()
