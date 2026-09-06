# Painted crop stages

Horizontal sheets, **four equal frames**, left → right:

1. Seed on the soil mound
2. Seedling
3. Growing with buds / flowers
4. Mature / ripe

| File | Crop kind (code) |
| --- | --- |
| `plant_corn_stages.png` | `corn` |
| `plant_strawberry_stages.png` | `strawberry` |
| `plant_cotton_stages.png` | `cotton` |

Each frame is **392px** wide. Sheets have transparent backgrounds and a shared soil-mound base so they can sit on the painted garden mounds. Do not bake crop names into the pixels — names live in game config / UI text.

Gameplay maps `growthStage` 1–4 (from the plant timer) onto these frames. Tier 1–3 map to corn / strawberry / cotton.
