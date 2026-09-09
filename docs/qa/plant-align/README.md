# Plant alignment QA

Locked look: **approved `plant_*_stages.png` with plant + clumpy soil disc as one unit.** Do not ship plant-only cutouts.

## Before (tablet / tiny icons)

The live zoom was drawing plant-only scraps at ~115px — leftover kernels and fragments that did not cover the painted mound. See [`before/`](before/) and the previous canvas `02_zoom_willow.png` from the plant-only pass.

## Restore

Original soil-disc sheets from `58d7d89` (1568 wide, 4×392 cells):

| Crop | Size | Disc (stage 1) |
| --- | --- | --- |
| corn | 1568×854 | center ≈ (196, 762), Ø 316 |
| strawberry | 1568×464 | center ≈ (160, 363), Ø 290 |
| cotton | 1568×623 | center ≈ (195, 520), Ø 325 |

Right-gutter packing scraps were zeroed (alpha) **without moving the plant**. Each cell is one soil+plant blob.

## Place + scale

- One sprite per plot; frame = growth stage only.
- Pixi pivot = **soil-disc center** (`cropDiscAnchor`), so a left-packed disc still lands on the mound UV.
- Zoom disc diameter **176px** (80% of the 220px pebble-ring cover). Farm mini-mounds **64px** (80% of 80px). Pivot stays on the soil-disc center.
- Garden camera is **0.85 of cover-fit**, capped at contain-fit so the full fence stays in view.
- Crop sheets are **1920×h / 4×480 cells** so left foliage is inside its own frame (no packed-gutter haircut).
- Soft umber ellipse under the zoom disc to hide any leftover painted ring.
- Empty plots keep the painted dirt.

## After unpack (480-wide cells)

Live Pixi canvas captures (`canvas.toDataURL`, `GARDEN_CAMERA_ZOOM = 0.85`, host 1280×800 → canvas 1280×713) are in [`after-fix/`](after-fix/):

| File | What it is |
| --- | --- |
| [`willow-mix.png`](after-fix/willow-mix.png) | Annotated Willow mix: ripe corn, **3-flower** center strawberry, two sprouts |
| [`strawberry-flower-3blossom.png`](after-fix/strawberry-flower-3blossom.png) | Stage 3 only — 3 white flowers + green berries (`/qa/garden?pack=blossom`) |
| [`strawberry-flower-3blossom-close.png`](after-fix/strawberry-flower-3blossom-close.png) | Close crop of that 3-flower plant |
| [`strawberries-ripe.png`](after-fix/strawberries-ripe.png) | All nine ripe strawberries |
| [`strawberry-flower-close.png`](after-fix/strawberry-flower-close.png) | Close crop of the 3-flower center plant |
| [`strawberry-center-close.png`](after-fix/strawberry-center-close.png) | Center ripe strawberry |

These are the running player at `/qa/garden?pack=willow` or `pack=blossom`, not composites. Sheet is **1920×464** (frame x = 2 / 482 / 962 / 1442). Stage 3 is the annotated 3-flower plant — do not mirror-replace that cell.

**Cache:** Pixi loads `/art/painted/plants/plant_*_stages.png?v=3blossom`. Workbox does not precache plant sheets (NetworkFirst). If an old 392px sheet is stuck, hard-refresh or unregister the service worker, then reload `/qa/garden?pack=blossom`.

Mound centers are playfield / texture pixels (`GARDEN_MOUND_PX`) on `garden_zoom_3x3.jpg` (1536×1024), never screen coords. Dirt and crops share one `playfield` container; `gardenPlayfieldFit` / `cameraFit` at `GARDEN_CAMERA_ZOOM = 0.85` is the only resize transform. `GARDEN_CROP_SEAT` is `{x:0,y:0}` — the sprite pivot is the soil-disc center on the mound UV.

Painted pebble-ring centers (white visual ground truth) vs the previous regular-grid estimate:

| Slot | Old | New |
| --- | --- | --- |
| 0 | 430, 317 | **447, 332** |
| 1 | 768, 317 | **774, 328** |
| 2 | 1106, 317 | **1102, 324** |
| 3 | 430, 541 | **439, 543** |
| 4 | 768, 541 | **772, 542** |
| 5 | 1106, 541 | **1104, 539** |
| 6 | 430, 760 | **434, 756** |
| 7 | 768, 760 | **770, 756** |
| 8 | 1106, 760 | **1106, 754** |

Live Pixi marker proof: `/qa/garden?pack=empty&markers=1` (white disc + red cross at each new local). Captures in [`after-fix/`](after-fix/).

## Pass bar

A human can name corn seed vs sprout vs stalk, strawberry, and cotton. The disc *is* the plot. No pink, no floating scraps.
