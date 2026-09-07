# Plant alignment QA

The tablet shot was not a “slightly off UV” problem. Each planted mound drew **more than one plant fragment** because the 1440×720 / 4×360 sheets packed leftover foliage from the next stage into the **same cell**.

A 0.5 / 1.0 Pixi pivot then sat the real stem left of the mound and the leftover scrap on the right/top — exactly “kernel on the left + mystery leaf on the right.”

## What was wrong (Hypothesis A, measured)

Broken sheets from `32547ec` (the rejected “UV peaks” commit):

| Sheet | Frame | Opaque blobs in the 360×720 cell |
| --- | --- | --- |
| corn | 0 | kernel **and** a leaf scrap |
| corn | 1 | sprout **and** 3 leaf slivers on the right edge |
| strawberry | 0 | seed **and** clipped leaves |
| cotton | 0 | seed **and** 2 sprout scraps |

Frame boundaries at x=360/720/1080 were clean (zero shared pixels). The engine was not slicing the wrong cell — **the cell itself contained multiple plants.**

See:

- [`before/sheet_corn_broken_f0.png`](before/sheet_corn_broken_f0.png) — kernel + floating leaf
- [`before/sheet_corn_broken_f1.png`](before/sheet_corn_broken_f1.png) — sprout + 3 scraps
- [`before/00_tablet_bug_reconstruction.jpg`](before/00_tablet_bug_reconstruction.jpg) — those frames dropped on the zoom painting at the slots the tablet showed

The user tablet JPEG was not present on this VM (`plant-align-ship/user_garden_zoom_broken.jpg`). The reconstruction uses the same broken frames the live player was serving.

## Fix

1. Keep only the stem-bearing blob in each cell (the component with the lowest pixels, `n ≥ 80`). Drop gutter scraps.
2. Recenter that stem to **(180, 712)** in the 360×720 cell.
3. Pixi `sliceSheet` still uses 4 equal cells with `SHEET_INSET = 2`.
4. `cropStemAnchor` pivots on that stem (`≈ 0.5, 0.992`).
5. One `Sprite` per plot. Farm height 34px; zoom height **115px** (row gap ≈ 223px — 200px mature corn grew into the mound above and looked like a second plant).
6. Farm / zoom UVs are hand-picked pebble-ring centers (slightly deep in the dirt), not dark-pixel CV (that locked onto shadow troughs and the picket gate).

After clean-pack every frame has **exactly 1 blob** and stem ≈ (180, 712). See [`after/sheet_corn_f0.png`](after/sheet_corn_f0.png) and [`sheets/`](sheets/).

## Live Pixi (one planted plot)

`GardenScene` / `FarmScene` expose `__farmhandGardenDebug()` / `__farmhandFarmDebug()`. After recapture, JSON dumps live in [`after/zoom_willow_pixi.json`](after/zoom_willow_pixi.json).

Expected for a planted zoom plot:

- `spritesOnPlot`: glow/sparkle sprites may exist, but **one** crop `Sprite` whose `frame.w` ≈ 356 and `frame.h` ≈ 716 (360×720 minus 2px inset)
- `anchor` ≈ `{ x: 0.5, y: 0.992 }`
- `world` stem sits on the mound, a few pixels below the UV (`ZOOM_PLANT_BURY_PX = 12`)

## UV tables (1536×1024)

Zoom mounds:

```
(0.28, 0.31) (0.50, 0.31) (0.72, 0.31)
(0.28, 0.528) (0.50, 0.528) (0.72, 0.528)
(0.28, 0.742) (0.50, 0.742) (0.72, 0.742)
```

Farm left / mid / right: see `playfieldLayout.ts`. Overlay copies [`01_farm_uv.jpg`](01_farm_uv.jpg) and [`01_farm_true_centers.jpg`](01_farm_true_centers.jpg) use the **same** points — those UVs *are* the hand-picked painted centers.

## Pass bar

A human can name the crop on each planted mound (corn kernel, corn stalk, strawberry, cotton). No leftover leaves on empty dirt. Empty mounds stay empty.
