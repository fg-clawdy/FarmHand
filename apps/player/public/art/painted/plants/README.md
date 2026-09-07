# Painted crop stages

Horizontal **plant-only** sheets (no soil discs / dirt cookies). Four equal frames, left → right:

1. Seed / kernel
2. Seedling
3. Growing with buds / flowers
4. Mature / ripe

Stem and seed bases fade into transparency so they composite onto the painted garden mounds. Anchor sprites at **bottom-center** of each frame.

| File | Crop kind (code) |
| --- | --- |
| `plant_corn_stages.png` | `corn` |
| `plant_strawberry_stages.png` | `strawberry` |
| `plant_cotton_stages.png` | `cotton` |

Each sheet is **1440×720**; each frame is **360×720**. Do not bake crop names into the pixels — names live in game config / UI text.

Gameplay maps `growthStage` 1–4 (from the plant timer) onto these frames. Tier 1–3 map to corn / strawberry / cotton.
