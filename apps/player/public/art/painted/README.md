# Painted farm playfield

Texture is **1536×1024**. UV anchors (fractions of the painting) live in `apps/player/src/pixi/playfieldLayout.ts`.

| File | Use |
| --- | --- |
| `farmhand_painted_playfield_v3_no_static_cow.jpg` | Farm scene background (cover-fit). No baked Holstein. Three gardens have blank wooden signs. |
| `tractor_exhaust_smoke_sheet.png` | 6-frame horizontal smoke puff. Frame 264×563. Anchor bottom-center (`0.5, 0.92`) on the **pipe mouth** at UV `(0.273, 0.252)` ≈ pixel `(419, 258)` — top of the vertical stack, not the hood. |
| `cow_walk_frame_a.png` / `cow_walk_frame_b.png` | Two standalone walk poses (**faces right only**). Loaded as two full textures — not sliced from a sheet. Loop for walk. Anchor feet `(0.5, 0.94)`. Left roam uses `scale.x = -1`. |
| `cow_eat_sheet.png` | 4 equal padded graze cells (426×304) with **real alpha**. Pixi slices inset 2px. Must stay PNG. Do **not** use `cow_walk_eat_sheet*.png`. |
| `plants/plant_*_stages.png` | 4-frame horizontal crop sheets (left→right: seed, seedling, buds, ripe). Frame width 480. Pivot on the soil-disc center of each painted garden mound. Crop **names are not painted on the art** — Pixi/React labels use `/api` tier names. |
| `garden/garden_zoom_3x3.jpg` | Zoomed garden close-up: fenced dirt with **nine empty mounds**, blank back sign, no animals. Cover-fit. |
| `garden/tool_seeds.png` / `tool_water.png` / `tool_fert.png` | Garden toolbar icons (PNG, real alpha). |

No Holstein is baked into the playfield. Only the animated calf is drawn; it weaves around barn, tractor, hay, stand, and garden fences.
