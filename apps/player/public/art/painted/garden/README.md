# Zoomed garden

`garden_zoom_3x3.jpg` is the fenced 3x3 mound close-up (1536x1024). No crops or animals are baked in. Tool icons stay **PNG** with real alpha.

| File | Use |
| --- | --- |
| `garden_zoom_3x3.jpg` | Cover-fit garden zoom background |
| `tool_seeds.png` | Seeds bag tool |
| `tool_water.png` | Watering can tool (unlocked for the day) |
| `tool_water_locked.png` | Watering can locked - show until today's selfie unlocks water |
| `tool_fert.png` | Fertilizer beaker tool |
| `harvest_basket.png` | Wide shallow painted harvest tray (body behind produce; true alpha; no handle) |
| `harvest_basket_rim.png` | Front rim/lip overlay in front of produce bottoms (same canvas / anchor as body) |

Mound UVs live in `apps/player/src/pixi/gardenLayout.ts`. Basket layout UV ~`(0.91, 0.88)` in `GARDEN_BASKET_LAYOUT`.

Basket art is an **original generated painted prop** (wide shallow tray, no handle), keyed to real alpha so grass does not ghost through. Body -> produce -> rim nesting; tall crop tops peek over the rim (soft pocket mask, not a tight rectangular clip). The old upright wicker+handle sprites are retired from garden display (kept only under `tmp/` as unused backups).
