#!/usr/bin/env python3
"""Compose Wanted flyers from wanted_poster_template.png + chore metadata.

App port: reimplement in Node (sharp/canvas) and call on chore create/update.
No placeholder flyer — every chore gets a real generated PNG.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps

TW, TH = 516, 772
ICON_BOX = (0.20, 0.44, 0.80, 0.66)
TITLE_BOX = (0.10, 0.68, 0.90, 0.84)
REWARD_BOX = (0.15, 0.86, 0.85, 0.95)


def region(box):
    l, t, r, b = box
    return int(l * TW), int(t * TH), int(r * TW), int(b * TH)


def aged_layer(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    gray = ImageOps.grayscale(im.convert("RGB"))
    brown = Image.merge(
        "RGB",
        (
            gray.point(lambda p: int(p * 0.55 + 20)),
            gray.point(lambda p: int(p * 0.35 + 10)),
            gray.point(lambda p: int(p * 0.15 + 5)),
        ),
    )
    brown = ImageEnhance.Contrast(brown).enhance(1.25)
    out = brown.convert("RGBA")
    out.putalpha(im.split()[-1])
    return out.filter(ImageFilter.GaussianBlur(0.35))


def fit_font(draw, text, font_path, max_w, max_h, start=44, min_size=12):
    size = start
    while size >= min_size:
        font = ImageFont.truetype(font_path, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_w and bbox[3] - bbox[1] <= max_h:
            return font
        size -= 2
    return ImageFont.truetype(font_path, min_size)


def wrap_text(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [text]


def render_emoji(emoji, size, emoji_font, serif):
    for psz in (109, 128, 96, 72):
        try:
            font = ImageFont.truetype(emoji_font, psz)
            big = Image.new("RGBA", (psz * 3, psz * 3), (0, 0, 0, 0))
            d = ImageDraw.Draw(big)
            d.text((big.width // 2, big.height // 2), emoji, font=font, embedded_color=True, anchor="mm")
            bbox = big.split()[-1].getbbox()
            if not bbox:
                continue
            cropped = big.crop(bbox).resize((size, size), Image.Resampling.LANCZOS)
            rgb = cropped.convert("RGB")
            mixed = Image.blend(rgb, ImageOps.grayscale(rgb).convert("RGB"), 0.25)
            out = mixed.convert("RGBA")
            out.putalpha(cropped.split()[-1])
            return out.filter(ImageFilter.GaussianBlur(0.25))
        except Exception:
            continue
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.ellipse((2, 2, size - 3, size - 3), fill=(236, 220, 190, 240), outline=(45, 28, 12, 255), width=3)
    font = ImageFont.truetype(serif, max(16, size // 4))
    d.text((size // 2, size // 2), emoji[:1], font=font, fill=(45, 28, 12, 255), anchor="mm")
    return canvas


def compose(template: Image.Image, chore: dict, serif: str, emoji_font: str) -> Image.Image:
    base = template.resize((TW, TH), Image.Resampling.LANCZOS).convert("RGBA")
    layer = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    probe = ImageDraw.Draw(Image.new("RGBA", (TW, TH)))

    il, it, ir, ib = region(ICON_BOX)
    icon_size = min(ir - il, ib - it) - 4
    emoji_im = render_emoji(chore["emoji"], icon_size, emoji_font, serif)
    layer.paste(emoji_im, (il + ((ir - il) - emoji_im.width) // 2, it + ((ib - it) - emoji_im.height) // 2), emoji_im)

    tl, tt, tr, tb = region(TITLE_BOX)
    max_w, max_h = tr - tl, tb - tt
    title = chore["title"].upper()
    font = fit_font(probe, title, serif, max_w, max_h // 2 + 8, start=40)
    lines = wrap_text(probe, title, font, max_w)
    line_h = probe.textbbox((0, 0), "Ay", font=font)[3] - probe.textbbox((0, 0), "Ay", font=font)[1]
    total_h = len(lines) * line_h + (len(lines) - 1) * 4
    y = tt + max(0, (max_h - total_h) // 2)
    for line in lines:
        bbox = probe.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        x = tl + (max_w - tw) // 2
        draw.text((x + 1, y + 1), line, font=font, fill=(95, 62, 28, 100))
        draw.text((x, y), line, font=font, fill=(40, 22, 8, 235))
        y += line_h + 4

    rl, rt, rr, rb = region(REWARD_BOX)
    reward = chore.get("reward") or "+1 SEED"
    rfont = fit_font(probe, reward, serif, rr - rl, rb - rt, start=26)
    bbox = probe.textbbox((0, 0), reward, font=rfont)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    rx = rl + ((rr - rl) - tw) // 2
    ry = rt + ((rb - rt) - th) // 2
    draw.text((rx + 1, ry + 1), reward, font=rfont, fill=(95, 62, 28, 90))
    draw.text((rx, ry), reward, font=rfont, fill=(50, 28, 10, 225))

    return Image.alpha_composite(base, aged_layer(layer))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", type=Path, required=True)
    ap.add_argument("--chores-json", type=Path, required=True, help='[{"slug","title","emoji","reward"?}]')
    ap.add_argument("--out-dir", type=Path, required=True)
    ap.add_argument("--serif", default="/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf")
    ap.add_argument("--emoji-font", default="/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf")
    args = ap.parse_args()
    template = Image.open(args.template).convert("RGBA")
    chores = json.loads(args.chores_json.read_text(encoding="utf-8"))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for c in chores:
        out = compose(template, c, args.serif, args.emoji_font)
        out.save(args.out_dir / f"{c['slug']}.png")
        print("wrote", c["slug"])


if __name__ == "__main__":
    main()
