# Painted farm playfield

Texture is **1536×1024**. UV anchors (fractions of the painting) live in `apps/player/src/pixi/playfieldLayout.ts`.

| File | Use |
| --- | --- |
| `farmhand_painted_playfield_v2_blank_signs.jpg` | Farm scene background (cover-fit). Three gardens have blank wooden signs. |
| `tractor_exhaust_smoke_sheet.png` | 6-frame horizontal smoke puff. Frame 264×563. Anchor bottom-center (`0.5, 0.92`) on the **pipe mouth** at UV `(0.273, 0.252)` ≈ pixel `(419, 258)` — top of the vertical stack, not the hood. |
| `cow_walk_eat_sheet.png` | 7-frame horizontal cow, **faces right only**. Frames 0–3 walk, 4–6 eat. Frame 228×247. Anchor ~0.5, 0.88. Left roam uses `scale.x = -1` — no left-facing sheet. |
| `plants/plant_*_stages.png` | 4-frame horizontal crop sheets (left→right: seed, seedling, buds, ripe). Frame width 392. Anchor ~0.5, 0.9 on each painted garden mound. Crop **names are not painted on the art** — Pixi/React labels use `/api` tier names. |

A static Holstein is baked into the playfield near the barn. The animated cow starts on that grass and covers it when nearby; a slight double is accepted for v1.
