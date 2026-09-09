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

Live Pixi canvas captures (`canvas.toDataURL`, `GARDEN_CAMERA_ZOOM = 0.85`) are in [`after-fix/`](after-fix/):

| File | What it is |
| --- | --- |
| [`empty-mounds-markers.png`](after-fix/empty-mounds-markers.png) | Empty plots, white disc + red cross on clawdy’s **white peaks** (landscape 1280×800) |
| [`empty-mounds-old-vs-new.png`](after-fix/empty-mounds-old-vs-new.png) | Overlay: cyan = old regular grid, white+red = new peaks; bottom row Δy ≈ −45px |
| [`empty-mounds-old-vs-new-stack.png`](after-fix/empty-mounds-old-vs-new-stack.png) | Stack: previous 5–15px retarget (top) vs white-peak anchors (bottom) |
| [`empty-mounds-markers-close.png`](after-fix/empty-mounds-markers-close.png) | Tight crops of those nine markers on the painted mounds |
| [`empty-mounds-markers-portrait.png`](after-fix/empty-mounds-markers-portrait.png) | Same markers, portrait 800×1280 — locals unchanged |
| [`empty-mounds-markers-tablet.png`](after-fix/empty-mounds-markers-tablet.png) | Tablet landscape 1024×768 |
| [`empty-mounds-markers-tablet-portrait.png`](after-fix/empty-mounds-markers-tablet-portrait.png) | Tablet portrait 768×1024 |
| [`willow-mix.png`](after-fix/willow-mix.png) | Annotated Willow mix on the new anchors (ripe corn, **3-flower** center strawberry, two sprouts) |
| [`willow-mix-portrait.png`](after-fix/willow-mix-portrait.png) | Same mix in portrait — `uvDx = 0`, `playfieldDrift = 0` |
| [`willow-full.png`](after-fix/willow-full.png) | All nine plots planted at zoom 0.85 |
| [`playfield-drift.json`](after-fix/playfield-drift.json) | Locals + `uvDx`/`uvDy`/`playfieldDrift` for landscape, portrait, tablet |
| [`strawberry-flower-3blossom.png`](after-fix/strawberry-flower-3blossom.png) | Stage 3 only — 3 white flowers + green berries (`/qa/garden?pack=blossom`) |
| [`strawberry-flower-3blossom-close.png`](after-fix/strawberry-flower-3blossom-close.png) | Close crop of that 3-flower plant |
| [`strawberries-ripe.png`](after-fix/strawberries-ripe.png) | All nine ripe strawberries |
| [`strawberry-flower-close.png`](after-fix/strawberry-flower-close.png) | Close crop of the 3-flower center plant |
| [`strawberry-center-close.png`](after-fix/strawberry-center-close.png) | Center ripe strawberry |

These are the running player at `/qa/garden?pack=willow` or `pack=blossom`, not composites. Sheet is **1920×464** (frame x = 2 / 482 / 962 / 1442). Stage 3 is the annotated 3-flower plant — do not mirror-replace that cell.

**Cache:** Pixi loads `/art/painted/plants/plant_*_stages.png?v=3blossom`. Workbox does not precache plant sheets (NetworkFirst). If an old 392px sheet is stuck, hard-refresh or unregister the service worker, then reload `/qa/garden?pack=blossom`.

Mound centers are playfield / texture pixels (`GARDEN_MOUND_PX`) on `garden_zoom_3x3.jpg` (1536×1024), never screen coords. Dirt and crops share one `playfield` container; `gardenPlayfieldFit` / `cameraFit` at `GARDEN_CAMERA_ZOOM = 0.85` is the only resize transform. `GARDEN_CROP_SEAT` is `{x:0,y:0}` — the sprite pivot is the soil-disc center on the mound UV.

**Clawdy approved** these visual-peak centers (commit `7d10a83`). Debug markers are opt-in only: `/qa/garden?pack=empty&markers=1`.

Painted visual-peak centers (clawdy white dots) vs the old regular-grid estimate. Bottom row moves ~45px up — the shift must be obvious in-game.

| Slot | Old | New | Δ |
| --- | --- | --- | --- |
| 0 | 430, 317 | **474, 342** | +44, +25 |
| 1 | 768, 317 | **768, 338** | 0, +21 |
| 2 | 1106, 317 | **1067, 339** | −39, +22 |
| 3 | 430, 541 | **472, 516** | +42, −25 |
| 4 | 768, 541 | **768, 518** | 0, −23 |
| 5 | 1106, 541 | **1088, 517** | −18, −24 |
| 6 | 430, 760 | **454, 713** | +24, −47 |
| 7 | 768, 760 | **771, 716** | +3, −44 |
| 8 | 1106, 760 | **1101, 712** | −5, −48 |

Live Pixi marker proof: `/qa/garden?pack=empty&markers=1` (white disc + red cross at each new local). Captures in [`after-fix/`](after-fix/).

## Home playfield (farm dashboard)

Clawdy white-peak UVs on `farmhand_painted_playfield_v3_no_static_cow.jpg` (1536×1024) for the three 3×3 gardens. Same UV + shared `playfield` / `coverFit` parenting as the rest of the farm. Opt-in markers: `/qa/farm?pack=empty&markers=1`. Willow zoom `GARDEN_MOUND_PX` is unchanged.

Proof captures: [`farm-mounds-markers.png`](after-fix/farm-mounds-markers.png), [`farm-mounds-old-vs-new.png`](after-fix/farm-mounds-old-vs-new.png), [`farm-crops.png`](after-fix/farm-crops.png).

## Pass bar

A human can name corn seed vs sprout vs stalk, strawberry, and cotton. The disc *is* the plot. No pink, no floating scraps.
