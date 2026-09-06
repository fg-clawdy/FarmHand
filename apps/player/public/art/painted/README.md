# Painted farm playfield

Texture is **1536×1024**. UV anchors (fractions of the painting) live in `apps/player/src/pixi/playfieldLayout.ts`.

| File | Use |
| --- | --- |
| `farmhand_painted_playfield_v2_blank_signs.jpg` | Farm scene background (cover-fit). Three gardens have blank wooden signs. |
| `tractor_exhaust_smoke_sheet.png` | 6-frame horizontal smoke puff. Frame 264×563. Anchor bottom-center on the exhaust tip at UV `(0.280, 0.318)` ≈ pixel `(430, 326)`. |
| `cow_walk_eat_sheet.png` | 7-frame horizontal cow. Frames 0–3 walk, 4–6 eat. Frame 228×247. Anchor ~0.5, 0.88. Flip `scale.x` to walk left. |

A static Holstein is baked into the playfield near the barn. The animated cow starts on that grass and covers it when nearby; a slight double is accepted for v1.
