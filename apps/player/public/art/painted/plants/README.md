# Painted crop stages

Approved horizontal sheets: **plant + clumpy dark soil disc as one unit**. Four equal frames, left to right:

1. Seed on the disc
2. Seedling
3. Growing with buds / flowers / fruit
4. Mature / ripe

Do not replace these with plant-only cutouts. The disc is the planted plot — scale it to cover the painted pebble-ring.

| File | Crop kind (code) | Sheet |
| --- | --- | --- |
| `plant_corn_stages.png` | `corn` | 1920×854 |
| `plant_strawberry_stages.png` | `strawberry` | 1920×464 |
| `plant_cotton_stages.png` | `cotton` | 1920×623 |
| `plant_tomato_stages.png` | `tomato` | 1920×854 |
| `plant_pumpkin_stages.png` | `pumpkin` | 1920×854 |
| `plant_sunflower_stages.png` | `sunflower` | 1920×854 |

Each frame is **480px** wide (unpacked so left foliage is not stored in the previous cell). Pivot on the **soil-disc center**, not the cell midpoint or stem tip.

Gameplay maps `growthStage` 1–4 onto these frames. Ladder (see NEW_CROP_REQ_PRD): corn → cotton → tomato → strawberry → pumpkin, plus sunflower as the sixth crop. Code wiring lands with CHORE_AND_SEED_PRD.
