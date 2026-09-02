# FarmHand art attribution

Player farm/garden scenes are a PixiJS hybrid with an **isometric cartoon** camera. React still owns PIN, sheets, HUD chrome, and the entire admin app. The attached painted mockup is **mood only** (warm colors, three kid cards, Farm Store) — not the camera to match.

## Art bible

Camera: classic farm-tycoon isometric (diamond tiles, Kenney 30° × 45°). Lighting: follow Kenney Miniature Farm (upper-left highlights, right-face shade). Outline: medium dark-brown. Palette: grass greens, barn/wood browns, sky blue, honey hay.

Packs were pulled and scored against that bible before anything was generated.

## Used on-screen

| Asset | Source | License | Where |
| --- | --- | --- | --- |
| Terrain (dirt, farmland, hay paths), hay bales, sacks, crates, fences, ladder, planks, barn/store wall+roof+chimney pieces, corn growth tiles | [Kenney Isometric Miniature Farm](https://kenney.nl/assets/isometric-miniature-farm) | CC0 | `/art/vendor/kenney/iso-miniature-farm/` (`*_N.png`, 128×256), packed into the runtime atlas + a large `pixi-tiledmap` iso ground (farm 22×22, garden 16×12) so Kenney diamonds fill the playfield |
| Grass ground | Kenney `dirt_N` with a green recolor of the tile top | CC0 derivative | iso map ground layer (the visible lawn — not a flat Graphics wash) |
| Crop stages seed → sprout → grown → mature | Kenney `cornYoung` / `corn` / `cornYoungDouble` / `cornDouble` + farmland seed mound; light recolor per FarmHand tier (daisy / herbs / sunflower). Oak mature adds a generated iso canopy on the Kenney stalk | CC0 + gap fill | garden plots + dashboard card previews |
| Ambient animals (cow, pig, chicken, duck, horse) | [Kenney Animal Pack Redux](https://kenney.nl/assets/animal-pack-remastered) stills | CC0 | `/art/vendor/kenney/animals/`. **Clips are incomplete:** the pack is front-facing stills, not iso walk/eat sheets. Walk/run bob the still; eat dips it; sit/lay reuse idle. `chick.png` is unused. No sheep still — horse fills the fifth yard animal. |
| HUD watering can, fertilizer beaker, acorn, wood name sign | Custom illustrated sprites | original | React/Pixi HUD only, not world tiles |
| Sky behind the iso diamond + small sun | Flat Pixi fill in the corners the diamond does not cover | original | behind the Kenney map only — no full-viewport green wash |

`pixi-tiledmap` (MIT) renders isometric Tiled maps (`orientation: "isometric"`, 128×64 diamonds). Sprites are packed at boot into one atlas texture.

## Leftover / not on the farm world

| Pack | License | Status |
| --- | --- | --- |
| Painted 3/4 homestead `farm_backdrop.jpg` | original (previous bible) | **Removed from the repo and runtime.** PIN / loading `SceneShell` is CSS sky only. Do not composite this over the iso map. |
| [Kenney Tiny Farm](https://kenney.nl/assets/tiny-farm) | CC0 | 16×16 pixel iso. License file kept; not drawn. |
| [LPC style farm animals](https://opengameart.org/content/lpc-style-farm-animals) (Daniel Eddeland) | CC-BY 3.0 / GPL 2.0 | Pixel top-down walk/eat. Right *actions*, wrong camera. Not copied. |
| [Levi Art Isometric Cartoon Farm](https://leviart.itch.io/isometric-cartoon-farm-tycoon-strategy-game-assets) | paid | Closest commercial upgrade (8 crops × 4 stages). **Not used** — not licensed. Do not pirate. |

Kenney CC0 does not require credit; we credit [Kenney.nl](https://www.kenney.nl) anyway.

## Gaps that still need custom / generated art

1. **Four distinct crop species** — pack only ships corn stages. Tiers are Kenney corn recolors plus a generated oak canopy.
2. **Iso animal clips** — Animal Pack Redux has no walk/eat/sit sheets and is not isometric. Yard animals are Kenney stills with bob. A true iso clip set (or the Levi pack if licensed) would replace the stills.
3. **True grass tileset** — Kenney Miniature Farm ships dirt/farmland, not lawn. Grass is a recolor of `dirt_N`.
4. **Farm Store shopfront** — assembled from Kenney door + roof + crate, not a dedicated store sprite.

## Runtime libraries

- PixiJS v8 — WebGL farm/garden scene
- pixi-tiledmap v2 — isometric Tiled maps + packed tile layers
- React + CSS — PIN, pickers, sheets, resource bar, admin
