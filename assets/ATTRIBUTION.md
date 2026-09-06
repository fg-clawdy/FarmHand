# FarmHand art attribution

Player farm/garden scenes are a PixiJS hybrid. The **farm dashboard** uses a ¾ painted cartoon playfield with ambient dressing; React still owns PIN, sheets, HUD chrome, and the entire admin app. Garden close-up still uses the generated full-bleed ground. Original art — not copied from Zynga or Supercell.

## Art bible

Farm camera: ¾ painted landscape (barn left, market stall right, three fenced gardens mid-field). The painting cover-fits the tablet canvas. Lighting is soft and sunny. Palette: lush grass greens, barn red, warm wood, cream sign boards. Child names are **never baked into the art** — Pixi text sits on the blank wooden signs.

## Used on-screen

| Asset | Source | License | Where |
| --- | --- | --- | --- |
| Painted farm playfield (barn, tractor, stall, three gardens with **blank** signs) | Original painted cartoon | original | `/art/painted/farmhand_painted_playfield_v2_blank_signs.jpg` — cover-fit. A grass Graphics fill (`#3d8a32`) sits underneath. |
| Tractor exhaust smoke (6-frame puff) | Original painted sheet | original | `/art/painted/tractor_exhaust_smoke_sheet.png` — looped at UV `(0.280, 0.318)` (exhaust pipe tip). |
| Cow walk (4) + eat/graze (3) | Original painted sheet | original | `/art/painted/cow_walk_eat_sheet.png` — roam/eat state machine in the paddock above the gardens. A static cow remains in the painting; the sprite covers it when nearby. |
| Live garden names | Pixi `Text` from `/api/farm` `player.name` | — | Centered on each blank sign. Admin **Edit → Name** updates the same field; the farm polls every 8s. |
| Garden close-up ground | Original generated painting | original | `/art/generated/ground/garden.jpg` |
| Crop stages + harvest sparkles | Original generated sheet | original | `/art/generated/crops/` + sparkles on ready farm gardens |
| HUD chips, watering can, fertilizer bottle | Same generated prop set | original | Slim edge HUD + React resource chrome |

The iso `pixi-tiledmap` diamond and the rolling-hills / sky backdrop are **not drawn**. Farm gardens are the three painted plots; compact seed/point chips stay at the bottom edge.

## Leftover / not on the farm world

| Pack | License | Status |
| --- | --- | --- |
| Previous generated farm ground `ground/farm.jpg` + barn/truck/rail props | original | **Unused on the farm dashboard** (replaced by the painted playfield). Garden close-up still uses `ground/garden.jpg`. |
| Generated ambient animal sheets | original | **Unused on the farm dashboard** (replaced by the painted cow). Still used in the garden close-up. |
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
