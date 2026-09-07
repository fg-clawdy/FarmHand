# FarmHand art attribution

Player farm/garden scenes are a PixiJS hybrid. The **farm dashboard** uses a ¾ painted cartoon playfield with ambient dressing; React still owns PIN, sheets, HUD chrome, and the entire admin app. Garden close-up still uses the generated full-bleed ground. Original art — not copied from Zynga or Supercell.

## Art bible

Farm camera: ¾ painted landscape (barn left, market stall right, three fenced gardens mid-field). The painting cover-fits the tablet canvas. Lighting is soft and sunny. Palette: lush grass greens, barn red, warm wood, cream sign boards. Child names are **never baked into the art** — Pixi text sits on the blank wooden signs.

## Used on-screen

| Asset | Source | License | Where |
| --- | --- | --- | --- |
| Painted farm playfield (barn, tractor, stall, three gardens with **blank** signs, **no** baked cow) | Original painted cartoon | original | `/art/painted/farmhand_painted_playfield_v3_no_static_cow.jpg` — cover-fit. A grass Graphics fill (`#3d8a32`) sits underneath. |
| Tractor exhaust smoke (6-frame puff) | Original painted sheet | original | `/art/painted/tractor_exhaust_smoke_sheet.png` — looped at UV `(0.273, 0.252)` ≈ px `(419, 258)` (mouth at the top of the vertical stack). |
| Cow walk (2 standalone poses) | Original painted frames | original | `/art/painted/cow_walk_frame_a.png` + `cow_walk_frame_b.png` — loaded as two full textures (no sheet slice). Faces right only; left roam flips `scale.x = -1`. Anchor at the hooves. |
| Cow eat/graze (4) | Original painted PNG with real alpha | original | `/art/painted/cow_eat_sheet.png` — 4 equal padded cells; must stay PNG. Old `cow_walk_eat_sheet*.png` is unused. |
| Live garden plaques | Pixi `Text` from `/api/farm` | — | Child **name** (primary) plus `seeds · pts` on each blank sign. Admin **Edit → Name** updates the same field; the farm polls every 8s. |
| Garden close-up ground | Original painted 3×3 zoom | original | `/art/painted/garden/garden_zoom_3x3.jpg` — cover-fit. No animals. |
| Garden tools (seeds bag, watering can, fertilizer flask) | Original painted PNG with real alpha | original | `/art/painted/garden/tool_*.png` — React toolbar; selected tool glows eligible mounds. |
| Crop stages (corn, strawberry, cotton × seed/seedling/buds/ripe) | Original painted sheets | original | `/art/painted/plants/plant_*_stages.png` — Pixi on farm mounds + garden close-up. Names stay in UI text. |
| Harvest sparkles | Original generated sheet | original | Sparkles on READY farm gardens |
| HUD chips, watering can, fertilizer bottle | Same generated prop set | original | Slim edge HUD + React resource chrome |

The iso `pixi-tiledmap` diamond and the rolling-hills / sky backdrop are **not drawn**. Farm gardens are the three painted plots. Seed/point counts live on the garden plaques with the child’s name — not on duplicate bottom cards.

## Leftover / not on the farm world

| Pack | License | Status |
| --- | --- | --- |
| Previous generated farm ground `ground/farm.jpg` + barn/truck/rail props | original | **Unused on the farm dashboard** (replaced by the painted playfield). Garden close-up still uses `ground/garden.jpg`. |
| Generated ambient animal sheets | original | **Unused on the farm dashboard and garden zoom** (garden close-up has no animals). |
| Generated iso tiles + picket fence pieces | original | **Unused at runtime.** Files remain under `/art/generated/tiles/` and `/art/generated/fence/`. |
| Rolling hills + sky + smiling sun `backdrop/hills.jpg` | original | **Unused at runtime.** Do not show sky around the farm. |
| [Kenney Isometric Miniature Farm](https://kenney.nl/assets/isometric-miniature-farm) | CC0 | **Unused at runtime.** Files remain under `/art/vendor/kenney/iso-miniature-farm/`. |
| [Kenney Animal Pack Redux](https://kenney.nl/assets/animal-pack-remastered) | CC0 | **Unused at runtime.** Files remain under `/art/vendor/kenney/animals/`. |
| [Kenney Tiny Farm](https://kenney.nl/assets/tiny-farm) | CC0 | License file kept; not drawn. |
| Painted 3/4 homestead `farm_backdrop.jpg` | original (previous bible) | **Removed.** |
| [LPC style farm animals](https://opengameart.org/content/lpc-style-farm-animals) (Daniel Eddeland) | CC-BY 3.0 / GPL 2.0 | Not copied. |
| [Levi Art Isometric Cartoon Farm](https://leviart.itch.io/isometric-cartoon-farm-tycoon-strategy-game-assets) | paid | **Not used** — not licensed. Do not pirate. |

Kenney CC0 does not require credit; we still credit [Kenney.nl](https://www.kenney.nl) for the unused vendor copies on disk.

## Runtime libraries

- PixiJS v8 — WebGL farm/garden scene
- React + CSS — PIN, pickers, sheets, resource bar, admin
