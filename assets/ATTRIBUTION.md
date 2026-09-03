# FarmHand art attribution

Player farm/garden scenes are a PixiJS hybrid with a **full-bleed painted homestead**. React still owns PIN, sheets, HUD chrome, and the entire admin app. The attached FarmVille 2 / Hay Day still is **craft and camera only** (ground to every edge, barn left, crop rows in the foreground). Original art — not copied from Zynga or Supercell.

## Art bible

Camera: 3/4 isometric look, but the **visible world is not a tile diamond**. A painted grass/dirt ground plane cover-fits the tablet canvas so ground fills 100% of the viewport. Lighting: sun upper-right, contact shadows lower-left. Style: glossy casual farm sim (FarmVille / Hay Day craft). Palette: lush grass greens, barn red, warm wood, honey hay. No blue sky wash around a floating plot.

## Used on-screen

| Asset | Source | License | Where |
| --- | --- | --- | --- |
| Full-bleed farm / garden ground (grass, dirt path, tilled rows to every edge) | Original generated paintings | original | `/art/generated/ground/farm.png`, `/art/generated/ground/garden.png` — loaded as standalone textures and cover-fit to the canvas. A grass Graphics fill (`#3d8a32`) sits underneath as a failsafe. |
| Barn + general store | Original generated building sprites | original | `/art/generated/buildings/` |
| Vintage truck, stone well, post-and-rail fence | Original generated props | original | `/art/generated/props/truck.png`, `well.png`, `rail.png` |
| Hay, crates, sacks, barrels, bushes | Original generated props | original | `/art/generated/props/` |
| Crop stages seed → sprout → grown → mature for daisy / herbs / sunflower / oak | Original generated sheet | original | `/art/generated/crops/` — wired to server `growthStage` 1–4 / READY. Ready crops get golden harvest sparkles. |
| Ambient animals (cow, chicken, pig, sheep, horse) × sit / lay / walk / run / eat | Original generated sheet | original | `/art/generated/animals/` — wander in screen space on the painted yard |
| HUD chips, watering can, fertilizer bottle, acorn, name sign | Same generated prop set | original | Slim edge HUD + React resource chrome |

The iso `pixi-tiledmap` diamond and the rolling-hills / sky backdrop are **not drawn**. Kid gardens are 2×3 plot clusters sitting in the painted world; compact name chips stay at the bottom edge.

## Leftover / not on the farm world

| Pack | License | Status |
| --- | --- | --- |
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
