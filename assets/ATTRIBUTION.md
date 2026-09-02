# FarmHand art attribution

Player farm/garden scenes are a PixiJS hybrid with an **isometric cartoon** camera. React still owns PIN, sheets, HUD chrome, and the entire admin app. The attached painted mockup is **mood only** (warm colors, three kid cards, Farm Store) — not the camera to match.

## Art bible

Camera: classic farm-tycoon isometric (diamond tiles, Kenney 30° × 45°). Lighting: follow Kenney Miniature Farm (upper-left highlights, right-face shade). Outline: medium dark-brown. Palette: grass greens, barn/wood browns, sky blue, honey hay.

Packs were pulled and scored against that bible before anything was generated.

## Used at runtime

| Asset | Source | License | Where |
| --- | --- | --- | --- |
| Terrain (dirt, farmland), hay, fences, sacks, barn/store wall+roof+chimney pieces, corn growth tiles | [Kenney Isometric Miniature Farm](https://kenney.nl/assets/isometric-miniature-farm) | CC0 | `/art/vendor/kenney/iso-miniature-farm/` (`*_N.png`, downscaled 128×256), packed into the runtime atlas + `pixi-tiledmap` iso tileset |
| Grass ground | Kenney `dirt_N` with a green recolor of the tile top | CC0 derivative | iso map ground layer |
| Crop stages seed → sprout → grown → mature | Kenney `cornYoung` / `corn` / `cornYoungDouble` / `cornDouble` + farmland seed mound; light recolor per FarmHand tier (daisy / herbs / sunflower). Oak mature adds a generated iso canopy on the Kenney stalk | CC0 + gap fill | garden plots + dashboard card previews |
| HUD watering can, fertilizer beaker, acorn, wood name sign | Custom illustrated sprites (unchanged HUD) | original | React/Pixi HUD only, not world tiles |
| Sky wash + smiling-sun rays | Drawn in Pixi to keep mockup warmth without the old 3/4 painted backdrop as the world | original | far layer |

`pixi-tiledmap` (MIT) renders isometric Tiled maps (`orientation: "isometric"`, 128×64 diamonds). Sprites are packed at boot into one atlas texture.

## Inventoried, then rejected (bible clash)

| Pack | License | Why it was not used on-screen |
| --- | --- | --- |
| Painted 3/4 homestead backdrop + 3/4 custom barn/animals | original (previous bible) | Camera no longer matches. Backdrop file remains in `/art/farm_backdrop.jpg` for the PIN shell mood wash only. |
| [Kenney Tiny Farm](https://kenney.nl/assets/tiny-farm) | CC0 | 16×16 pixel iso. Right *idea*, wrong scale/outline vs 256px miniature farm. |
| [Kenney Animal Pack Redux](https://kenney.nl/assets/animal-pack-remastered) | CC0 | Flat front-facing icons. No iso camera, no walk/eat clips. Copies under `apps/player/public/art/vendor/kenney/` for license proof only. |
| [LPC style farm animals](https://opengameart.org/content/lpc-style-farm-animals) (Daniel Eddeland) | CC-BY 3.0 / GPL 2.0 | Pixel top-down walk/eat. Right *actions*, wrong camera. Not copied. |
| [Levi Art Isometric Cartoon Farm](https://leviart.itch.io/isometric-cartoon-farm-tycoon-strategy-game-assets) | paid | Closest commercial upgrade (8 crops × 4 stages). **Not used** — not licensed in this repo. Do not pirate. |

Kenney CC0 does not require credit; we credit [Kenney.nl](https://www.kenney.nl) anyway.

## Gaps that still need custom / generated art

After the Kenney iso inventory:

1. **Four distinct crop species** — pack only ships corn stages. Tiers are Kenney corn recolors plus a generated oak canopy; a true daisy/herb/sunflower/oak iso set (or the Levi pack if licensed) would replace the tints.
2. **Iso animal clips** — Kenney Miniature Farm has no animals. No CC0 iso farm pack with sit/lay/walk/run/eat matched this camera. This PR draws generated iso **walk / eat / idle** clips (same 30° lighting). **sit** and **lay** reuse idle; **run** reuses walk at higher speed. Remaining generate work: distinct sit, lay, run, and a duck/chicken that isn’t a reposed quadruped.
3. **True grass tileset** — Kenney ships dirt/farmland, not lawn. Grass is a recolor of `dirt_N`.
4. **Farm Store shopfront** — assembled from Kenney door + roof + crate, not a dedicated store sprite.

## Runtime libraries

- PixiJS v8 — WebGL farm/garden scene
- pixi-tiledmap v2 — isometric Tiled maps + packed tile layers
- React + CSS — PIN, pickers, sheets, resource bar, admin
