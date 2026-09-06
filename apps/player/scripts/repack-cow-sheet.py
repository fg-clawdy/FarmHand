#!/usr/bin/env python3
"""Rebuild cow_walk_eat_sheet.png so each cow is whole, padded, and non-overlapping.

The source 1596×247 sheet uses 7×228 cells, but each cow is wider than 228px.
The snout (walk) or tail (eat) lands in the next cell, so equal slices show a
detached head behind the following cow. This script:

1. Treats left-of-body pixels in cell i+1 as belonging to cow i
2. Slides that leftover next to cow i (closes the destroyed 228-cut gap)
3. Centers every cow in an equal cell with pad + gutter so Pixi cannot bleed
"""

from pathlib import Path

from PIL import Image
import numpy as np

SRC = Path(__file__).resolve().parents[1] / "public/art/painted/cow_walk_eat_sheet.png"
FRAMES = 7
HEAD_Y = 130
PAD = 10
GUTTER = 2
OVERLAP = 10  # cover the destroyed 228-cut through the face


def content_mask(arr: np.ndarray) -> np.ndarray:
    return arr[:, :, 3] > 8


def trim_x(im: Image.Image) -> Image.Image:
    m = content_mask(np.array(im))
    cols = np.where(m.any(axis=0))[0]
    if len(cols) == 0:
        return im
    return im.crop((int(cols[0]), 0, int(cols[-1]) + 1, im.height))


def body_start(mask: np.ndarray, y0: int) -> int:
    """First column with a real torso, ignoring stray tail-tuft pixels."""
    strength = mask[y0:, :].sum(axis=0)
    cols = np.where(strength >= 12)[0]
    return int(cols[0]) if len(cols) else 0


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    arr = np.array(src)
    mask = content_mask(arr)
    h, w = mask.shape
    cell = w // FRAMES
    cows: list[Image.Image] = []

    for i in range(FRAMES):
        x0 = i * cell
        sl = mask[:, x0 : x0 + cell]
        start = body_start(sl, HEAD_Y)
        local = src.crop((x0 + start, 0, x0 + cell, h))
        local = trim_x(local)

        if i + 1 < FRAMES:
            nx0 = (i + 1) * cell
            nsl = mask[:, nx0 : nx0 + cell]
            n_start = body_start(nsl, HEAD_Y)
            leftover_cols = np.where(nsl.any(axis=0)[:n_start])[0]
            if len(leftover_cols):
                lx0 = nx0 + int(leftover_cols[0])
                lx1 = nx0 + int(leftover_cols[-1]) + 1
                leftover = trim_x(src.crop((lx0, 0, lx1, h)))
                joined = Image.new("RGBA", (local.width + leftover.width - OVERLAP, h), (0, 0, 0, 0))
                joined.alpha_composite(local, (0, 0))
                joined.alpha_composite(leftover, (local.width - OVERLAP, 0))
                local = joined

        cows.append(trim_x(local))

    max_w = max(c.width for c in cows)
    cell_w = max_w + PAD * 2 + GUTTER * 2
    out = Image.new("RGBA", (cell_w * FRAMES, h), (0, 0, 0, 0))
    for i, cow in enumerate(cows):
        x = i * cell_w + (cell_w - cow.width) // 2
        out.alpha_composite(cow, (x, 0))
    out.save(SRC)
    print(f"wrote {SRC.name} {out.size} cell={cell_w}x{h} cows={[c.width for c in cows]}")


if __name__ == "__main__":
    main()
