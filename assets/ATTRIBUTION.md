# FarmHand art attribution

Player farm/garden scenes are a PixiJS hybrid with an **isometric cartoon** camera. React still owns PIN, sheets, HUD chrome, and the entire admin app. The attached painted dashboard mockup is **mood only** (warm colors, three kid cards, Farm Store).

## Art bible

Camera: classic farm-tycoon isometric (diamond tiles). Lighting: sun upper-right, contact shadows lower-left. Style: glossy casual farm sim (FarmVille / Hay Day craft) — original generated art, not copied from Zynga or Supercell. Palette: lush grass greens, barn red, sky blue, warm wood, honey hay.

## Used on-screen

| Asset | Source | License | Where |
| --- | --- | --- | --- |
| Terrain (grass, dirt, tilled farmland, cobble path) | Original generated iso tiles | original | `/art/generated/tiles/`, packed into a `pixi-tiledmap` iso ground (farm 40×40, garden 28×22) with the homestead in the diamond center |
| White picket fence (one paddock ring) | Original generated SW/SE pieces | original | `/art/generated/fence/` |
| Barn + general store | Original generated building sprites | original | `/art/generated/buildings/` |
| Crop stages seed → sprout → grown → mature (+ harvest glow) for daisy / herbs / sunflower / oak | Original generated sheet, sliced into atlas frames | original | `/art/generated/crops/` — wired to server `growthStage` 1–4 / READY |
| Ambient animals (cow, chicken, pig, sheep, horse) × sit / lay / walk / run / eat | Original generated sheet; walk/run/eat interpolate extra bob frames from stills | original | `/art/generated/animals/` |
| Hay, crates, sacks, barrels, bushes, ladder, wooden garden signs | Original generated props | original | `/art/generated/props/` |
| Rolling hills + sky + smiling sun | Original generated backdrop | original | `/art/generated/backdrop/hills.jpg` — sits *behind* the iso map so tiles still fill the playfield |
| HUD watering can, fertilizer bottle, acorn, name sign | Same generated prop set | original | Pixi cards / React resource chrome |

`pixi-tiledmap` (MIT) renders isometric Tiled maps (`orientation: "isometric"`, 128×64 diamonds). Sprites are packed at boot into one atlas texture.

## Leftover / not on the farm world

| Pack | License | Status |
| --- | --- | --- |
| [Kenney Isometric Miniature Farm](https://kenney.nl/assets/isometric-miniature-farm) | CC0 | **Unused at runtime.** Files remain under `/art/vendor/kenney/iso-miniature-farm/`. |
| [Kenney Animal Pack Redux](https://kenney.nl/assets/animal-pack-remastered) | CC0 | **Unused at runtime.** Files remain under `/art/vendor/kenney/animals/`. |
| [Kenney Tiny Farm](https://kenney.nl/assets/tiny-farm) | CC0 | License file kept; not drawn. |
| Painted 3/4 homestead `farm_backdrop.jpg` | original (previous bible) | **Removed.** Do not composite over the iso map. |
| [LPC style farm animals](https://opengameart.org/content/lpc-style-farm-animals) (Daniel Eddeland) | CC-BY 3.0 / GPL 2.0 | Not copied. |
| [Levi Art Isometric Cartoon Farm](https://leviart.itch.io/isometric-cartoon-farm-tycoon-strategy-game-assets) | paid | **Not used** — not licensed. Do not pirate. |

Kenney CC0 does not require credit; we still credit [Kenney.nl](https://www.kenney.nl) for the unused vendor copies on disk.

## Runtime libraries

- PixiJS v8 — WebGL farm/garden scene
- pixi-tiledmap v2 — isometric Tiled maps + packed tile layers
- React + CSS — PIN, pickers, sheets, resource bar, admin
