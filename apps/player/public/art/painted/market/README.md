# Farmers Market art

Painted produce icons + truck for the sell sheet. All PNGs are **true RGBA**
(checkerboard backdrop flood-matted; baked originals under `tmp/market_baked_checker_bak/`).

| File | CropKind / use |
| --- | --- |
| `truck.png` | Sell CTA (no white box) |
| `produce_sweet_corn.png` | `corn` (aliases `sweet_corn` / `sweetCorn`) |
| `produce_cotton.png` | `cotton` |
| `produce_sunflower.png` | `sunflower` |

Kinds without custom art (`tomato`, `strawberry`, `pumpkin`) use the line emoji fallback.

Cache-bust query: `?v=1` from `HarvestBasketSheet.tsx`.
