# FarmHand art attribution

Player farm/garden scenes are a PixiJS hybrid. React still owns PIN, sheets, HUD chrome, and the entire admin app.

## Art bible

Camera: slight 3/4 elevated side (mockup north star). Lighting: sun upper-right, contact shadows lower-left. Outline: warm dark brown, medium weight. Palette: saturated grass greens, barn red, sky blue, honey wood.

Packs were pulled and scored against that bible before anything was generated.

## Used at runtime

| Asset | Source | License | Where |
| --- | --- | --- | --- |
| Painted homestead backdrop | Custom (gap fill) | original | `/art/farm_backdrop.jpg` far parallax layer |
| Barn, store, watering can, fertilizer, acorn, wood sign, mature daisy/sunflower/oak/sprout, sheep, duck | Custom illustrated sprites (gap fill) | original | packed into the runtime texture atlas |
| Grass / dirt / path / water / flower tiles | Custom painted 64px tileset matching the backdrop | original | `pixi-tiledmap` `createMap` farm + garden maps |
| Crop stages seed → sprout → grown → mature | Custom atlas frames per tier (Prairie Daisy, Kitchen Herbs, Sunflower, Homestead Oak) | original | garden plots + dashboard previews |
| Animal clips sit / lay / walk / run / eat | Custom atlas clips (cow, chicken, pig, sheep, duck) with idle AI | original | ambient dashboard + garden |

`pixi-tiledmap` (MIT) loads/renders those maps. Sprites are packed at boot into one atlas texture (TexturePacker-style frames) instead of loose GPU uploads.

## Inventoried, then rejected (bible clash)

| Pack | License | Why it was not used on-screen |
| --- | --- | --- |
| [Kenney Tiny Farm](https://kenney.nl/assets/tiny-farm) | CC0 | 16×16 pixel, top-down/tiny isometric. Wrong camera scale and outline vs the painted 3/4 mockup. Has useful crop-stage *coverage* (we matched that 4-stage structure) but the pixels clash with the painted barn/sky. |
| [Kenney Animal Pack Redux](https://kenney.nl/assets/animal-pack-remastered) (Round / Round outline) | CC0 | Cute front-facing flat icons. No sit/lay/walk/run/eat clips, and the camera is orthographic sticker, not 3/4 farm. Copies kept only under `apps/player/public/art/vendor/kenney/` for license proof, not drawn in the Pixi stage. |
| [LPC style farm animals](https://opengameart.org/content/lpc-style-farm-animals) (Daniel Eddeland) | CC-BY 3.0 / GPL 2.0 | Pixel top-down walk/eat sheets. Right *actions*, wrong camera and silhouette. |

Kenney CC0 does not require credit; we credit [Kenney.nl](https://www.kenney.nl) anyway. LPC was not copied into the repo.

## Gaps that still needed custom art

After the inventory, these were missing in any CC0 pack that also matched the bible:

1. 3/4 painted crop stages for all four FarmHand tiers
2. Animal action clips (sit, lay, walk, run, eat) in that same camera/lighting
3. A grass/dirt tileset that can sit under the painted backdrop without looking like a different game
4. Barn / Farm Store / HUD props at mockup craft level

Those gaps are the custom sprites and the generated tileset/atlas frames above.

## Runtime libraries

- PixiJS v8 — WebGL farm/garden scene
- pixi-tiledmap v2 — Tiled map IR + packed tile layers + parallax
- React + CSS — PIN, pickers, sheets, resource bar, admin
