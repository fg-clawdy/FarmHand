#!/usr/bin/env python3
"""Paint the farm little-library sprite.

Fractions match libraryHouseMetrics() in libraryShelfLayout.ts.
Open cabinet, no door, empty shelves. No vector outlines.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# 4× the on-field box (170×210).
W, H = 680, 840


def metrics(w: float, h: float):
    body_x = w * 0.04
    body_w = w * 0.78
    body_y = h * 0.145
    body_h = h * 0.55
    wall = max(6.0, body_w * 0.075)
    eave_y = body_y + h * 0.012
    post_w = max(14.0, w * 0.16)
    post_x = body_x + body_w * 0.42 - post_w / 2
    post_y = body_y + body_h - h * 0.008
    interior = {
        "x": body_x + wall * 0.85,
        "y": body_y + body_h * 0.08,
        "w": body_w - wall * 1.7,
        "h": body_h * 0.84,
    }
    return {
        "body": (body_x, body_y, body_w, body_h),
        "interior": interior,
        "post": (post_x, post_y, post_w, max(8.0, h - post_y)),
        "eave_y": eave_y,
        "apex": (body_x + body_w * 0.46, h * 0.018),
        "roof_left": body_x - w * 0.035,
        "roof_right": body_x + body_w + w * 0.015,
        "star": (body_x + body_w * 0.46, h * 0.078, max(5.0, w * 0.042)),
        "depth_x": w * 0.145,
        "depth_y": -h * 0.028,
    }


def shelf_pair(iw: float, ih: float):
    pad_x = max(4.0, iw * 0.05)
    pad_y = max(4.0, ih * 0.04)
    gap = max(6.0, ih * 0.05)
    inner_w = max(1.0, iw - pad_x * 2)
    cubby_h = max(1.0, (ih - pad_y * 2 - gap) / 2)
    return [
        (pad_x, pad_y, inner_w, cubby_h),
        (pad_x, pad_y + cubby_h + gap, inner_w, cubby_h),
    ]


def new_canvas():
    return np.zeros((H, W, 4), dtype=np.float32)


def over(dst, rgb, alpha):
    a = np.clip(np.asarray(alpha, dtype=np.float32), 0, 1)[..., None]
    src = np.asarray(rgb, dtype=np.float32)
    if src.ndim == 1:
        src = src.reshape(1, 1, 3)
    da = dst[..., 3:4]
    out_a = a + da * (1.0 - a)
    premul = src * a + dst[..., :3] * da * (1.0 - a)
    dst[..., :3] = np.where(out_a > 1e-4, premul / np.maximum(out_a, 1e-4), 0)
    dst[..., 3:4] = out_a


def mask_draw(fn, blur=1.0):
    im = Image.new("L", (W, H), 0)
    fn(ImageDraw.Draw(im))
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im).astype(np.float32) / 255.0


def lit(color, light=1.18, dark=0.66, y0=0, y1=None, top=1.05, bot=0.9):
    """Left-bright, right-shadow, optional vertical falloff. color is 0-255."""
    if y1 is None:
        y1 = H - 1
    xs = np.linspace(light, dark, W, dtype=np.float32)[None, :, None]
    ys = np.arange(H, dtype=np.float32)[:, None, None]
    t = np.clip((ys - y0) / max(1.0, y1 - y0), 0, 1)
    col = np.array(color, np.float32).reshape(1, 1, 3) * xs * ((1 - t) * top + t * bot)
    return np.broadcast_to(col, (H, W, 3)).copy()


def star_pts(cx, cy, r, inner=0.46):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * inner
        pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
    return pts


def round_poly(draw, pts, radius, fill=255):
    """Chunky painted polygon. PIL polygon is enough; softness comes from blur."""
    draw.polygon(pts, fill=fill)


def paint_library():
    m = metrics(W, H)
    bx, by, bw, bh = m["body"]
    ix, iy, iw, ih = (m["interior"][k] for k in ("x", "y", "w", "h"))
    px, py, pw, ph = m["post"]
    apex_x, apex_y = m["apex"]
    dx, dy = m["depth_x"], m["depth_y"]
    dst = new_canvas()
    rng = np.random.default_rng(11)

    # Grass contact shadow — wide, soft, low.
    shadow = mask_draw(
        lambda d: d.ellipse((px - pw * 0.35, H * 0.948, px + pw * 1.85, H * 0.992), fill=255),
        blur=9,
    )
    over(dst, (42, 68, 16), shadow * 0.38)

    # Wooden post, slightly wider at the bottom, round in section.
    top_w = pw * 0.92
    bot_w = pw * 1.08
    cx = px + pw / 2
    post_pts = [
        (cx - top_w / 2, py),
        (cx + top_w / 2, py + H * 0.01),
        (cx + bot_w / 2, py + ph - 2),
        (cx - bot_w / 2, py + ph - 2),
    ]
    post = mask_draw(lambda d: d.polygon(post_pts, fill=255), blur=1.1)
    # round the silhouette a bit more
    post = np.array(Image.fromarray((post * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.4))).astype(np.float32) / 255.0
    over(dst, lit((206, 142, 58), 1.28, 0.55, py, py + ph, 1.08, 0.86), post)
    # Cylindrical highlight, left of center.
    cyl = mask_draw(
        lambda d: d.polygon(
            [
                (cx - top_w * 0.28, py + 6),
                (cx - top_w * 0.02, py + 8),
                (cx - bot_w * 0.02, py + ph - 8),
                (cx - bot_w * 0.32, py + ph - 6),
            ],
            fill=255,
        ),
        blur=2.2,
    )
    over(dst, (255, 226, 168), cyl * post * 0.42)
    # Grain waves.
    grain = np.zeros((H, W), np.float32)
    yy = np.arange(H)
    for i in range(7):
        base = cx - top_w * 0.35 + top_w * 0.12 * i
        wob = np.sin(yy * 0.045 + i * 1.3) * 1.6
        xs = np.clip((base + wob).astype(int), 0, W - 1)
        grain[yy, xs] = 0.22
    grain_img = Image.fromarray((np.clip(grain, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    grain = np.asarray(grain_img).astype(np.float32) / 255.0
    over(dst, (110, 62, 22), grain * post * 0.55)

    # Platform the house sits on — top face plus front face.
    cap_w = pw * 2.35
    cap_top = py - H * 0.02
    cap_bot = py + H * 0.008
    cap = mask_draw(
        lambda d: d.rounded_rectangle((cx - cap_w / 2, cap_top, cx + cap_w / 2, cap_bot), radius=6, fill=255),
        blur=0.8,
    )
    over(dst, lit((176, 112, 48), 1.12, 0.62, cap_top, cap_bot, 1.15, 0.75), cap)

    # Right wall — big enough to read as the side of the box.
    side = [
        (bx + bw * 0.98, by + bh * 0.02),
        (bx + bw + dx, by + dy + bh * 0.04),
        (bx + bw + dx * 0.96, by + bh + dy * 0.25),
        (bx + bw * 0.99, by + bh),
    ]
    side_m = mask_draw(lambda d: d.polygon(side, fill=255), blur=1.0)
    over(dst, lit((122, 40, 18), 0.92, 0.58, by, by + bh, 1.0, 0.78), side_m)

    # Side roof plane, clearly darker and receding.
    roof_side = [
        (apex_x, apex_y + 2),
        (apex_x + dx * 0.78, apex_y + dy * 0.55),
        (m["roof_right"] + dx * 0.62, m["eave_y"] + dy * 0.15),
        (m["roof_right"] - 2, m["eave_y"] + 2),
    ]
    side_roof = mask_draw(lambda d: d.polygon(roof_side, fill=255), blur=0.9)
    over(dst, lit((104, 32, 16), 0.85, 0.55), side_roof)

    # Front wall, slightly narrower at the top.
    inset_top = bw * 0.035
    front_pts = [
        (bx + inset_top, by),
        (bx + bw - inset_top * 0.4, by),
        (bx + bw, by + bh),
        (bx, by + bh),
    ]
    front = mask_draw(lambda d: d.polygon(front_pts, fill=255), blur=1.15)
    over(dst, lit((204, 72, 28), 1.26, 0.7, by, by + bh, 1.08, 0.88), front)
    # Soft left bevel.
    bevel = mask_draw(
        lambda d: d.polygon([(bx, by + bh), (bx + inset_top, by), (bx + bw * 0.08, by + 6), (bx + bw * 0.05, by + bh)], fill=255),
        blur=2.5,
    )
    over(dst, (255, 168, 110), bevel * front * 0.28)

    # Front roof slab with thickness.
    eave = m["eave_y"]
    thick = H * 0.028
    roof_front = [
        (m["roof_left"], eave),
        (apex_x, apex_y),
        (m["roof_right"], eave),
        (m["roof_right"] - bw * 0.015, eave + thick),
        (m["roof_left"] + bw * 0.02, eave + thick),
    ]
    roof = mask_draw(lambda d: d.polygon(roof_front, fill=255), blur=1.0)
    over(dst, lit((188, 64, 26), 1.32, 0.68, apex_y, eave + thick, 1.14, 0.86), roof)
    # Shingle rhythm — soft, not lines.
    bands = np.zeros((H, W), np.float32)
    for i, t in enumerate(np.linspace(0.22, 0.9, 6)):
        y = apex_y + (eave - apex_y) * t
        bands += np.exp(-((np.arange(H) - y) ** 2) / (2.4**2))[:, None] * (0.18 if i % 2 == 0 else 0.08)
    over(dst, (96, 28, 14), bands * roof * 0.7)
    # Left slope sheen.
    sheen = mask_draw(
        lambda d: d.polygon(
            [
                (m["roof_left"] + 18, eave - 8),
                (apex_x - 8, apex_y + 16),
                (apex_x - bw * 0.12, apex_y + (eave - apex_y) * 0.62),
            ],
            fill=255,
        ),
        blur=4,
    )
    over(dst, (255, 186, 120), sheen * roof * 0.4)

    # Shadow under the eave, on the front wall only.
    eave_sh = mask_draw(lambda d: d.rectangle((bx, eave, bx + bw, eave + H * 0.045), fill=255), blur=3.5)
    over(dst, (70, 22, 12), eave_sh * front * 0.4)

    # Cabinet recess. Dark throat, then a smaller cream back plane.
    opening = mask_draw(lambda d: d.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=10, fill=255), blur=0.7)
    over(dst, lit((78, 40, 20), 0.9, 0.7, iy, iy + ih, 0.75, 1.0), opening)
    back_pad = max(8.0, iw * 0.045)
    back = mask_draw(
        lambda d: d.rounded_rectangle(
            (ix + back_pad * 0.35, iy + back_pad * 0.45, ix + iw - back_pad * 1.1, iy + ih - back_pad * 0.15),
            radius=7,
            fill=255,
        ),
        blur=0.8,
    )
    over(dst, lit((232, 204, 156), 1.06, 0.8, iy, iy + ih, 0.9, 1.02), back)
    # Ambient occlusion inside the hole.
    yy = np.arange(H)[:, None]
    xx = np.arange(W)[None, :]
    ao = np.clip(1 - (yy - iy) / (ih * 0.28), 0, 1) * 0.55
    ao = np.maximum(ao, np.clip(1 - (xx - ix) / (iw * 0.14), 0, 1) * 0.22)
    ao = np.maximum(ao, np.clip(1 - (ix + iw - xx) / (iw * 0.12), 0, 1) * 0.16)
    over(dst, (62, 30, 14), ao * back)

    # Shelf planks with a lit top and a darker front lip. Jars rest on the cubby bottom.
    for sx, sy, sw, sh_ in shelf_pair(iw, ih):
        lip = iy + sy + sh_
        board = max(9.0, H * 0.016)
        top = mask_draw(
            lambda d, lip=lip, sx=sx, sw=sw, board=board: d.rounded_rectangle(
                (ix + sx + 1, lip - board * 0.55, ix + sx + sw - 1, lip + board * 0.05),
                radius=3,
                fill=255,
            ),
            blur=0.6,
        )
        face = mask_draw(
            lambda d, lip=lip, sx=sx, sw=sw, board=board: d.rounded_rectangle(
                (ix + sx - iw * 0.012, lip - 1, ix + sx + sw + iw * 0.012, lip + board),
                radius=3,
                fill=255,
            ),
            blur=0.55,
        )
        over(dst, lit((228, 168, 84), 1.18, 0.78), top)
        over(dst, lit((156, 96, 40), 1.08, 0.66), face)
        # soft underside shadow into the cubby below
        under = mask_draw(
            lambda d, lip=lip, sx=sx, sw=sw, board=board: d.rectangle(
                (ix + sx, lip + board * 0.7, ix + sx + sw, lip + board * 1.8),
                fill=255,
            ),
            blur=1.6,
        )
        over(dst, (70, 36, 16), under * back * 0.35)

    # Star — soft painted, not a UI glyph.
    scx, scy, sr = m["star"]
    glow = mask_draw(lambda d: d.ellipse((scx - sr * 1.8, scy - sr * 1.7, scx + sr * 1.8, scy + sr * 1.7), fill=255), blur=3)
    over(dst, (255, 210, 110), glow * roof * 0.45)
    star = mask_draw(lambda d: d.polygon(star_pts(scx, scy, sr), fill=255), blur=0.8)
    over(dst, lit((236, 176, 58), 1.15, 0.9), star)
    star_in = mask_draw(lambda d: d.polygon(star_pts(scx, scy - sr * 0.04, sr * 0.62), fill=255), blur=0.6)
    over(dst, (255, 236, 180), star_in * 0.85)

    # Brush speckle.
    noise = rng.normal(0, 1, (H, W)).astype(np.float32)
    noise = np.array(Image.fromarray(np.clip(noise * 28 + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)))
    noise = (noise.astype(np.float32) - noise.mean())[..., None]
    dst[..., :3] = np.clip(dst[..., :3] + noise * 0.45 * (dst[..., 3:4] > 0.25), 0, 255)
    return dst


def to_image(arr):
    out = np.zeros_like(arr)
    out[..., :3] = np.clip(arr[..., :3], 0, 255)
    out[..., 3] = np.clip(arr[..., 3] * 255.0, 0, 255)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def main():
    img = to_image(paint_library())
    art = Path(__file__).resolve().parents[1] / "public/art/painted"
    out = art / "farm/little_library.png"
    img.save(out)
    print("sprite", img.size, out)

    farm = Image.open(art / "farmhand_painted_playfield_v3_no_static_cow.jpg").convert("RGBA")
    sw, sh = 170, 210
    sp = img.resize((sw, sh), Image.Resampling.LANCZOS)
    x = 529 - sw // 2
    y = 400 - sh
    print("place", x, y)
    layer = farm.copy()
    layer.alpha_composite(sp, (x, y))
    # tight, so the prop fills the frame
    tight = layer.crop((x - 16, y - 8, x + sw + 28, y + sh + 16))
    tight.convert("RGB").resize((520, 640), Image.Resampling.LANCZOS).save("/tmp/lib_tight.jpg", quality=93)
    layer.convert("RGB").crop((300, 80, 860, 520)).save("/tmp/farm_painted.jpg", quality=92)
    print("previews")


if __name__ == "__main__":
    main()
