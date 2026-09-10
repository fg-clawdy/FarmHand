> **Current status:** Phase 6 — Camera/style pivot: Stardew-style 3/4 axis-aligned
> Blender renders replacing the Kenney diamond-isometric tileset for world art.
> Old diamond-iso sprite-sheets below (Phase 5) are kept for reference/fallback
> only until animals/props are re-generated to match the new bible.
> Regenerate world art with the Blender pipeline in `blender_mcp/mcp/`
> (`ASSET_STYLE_GUIDE.md` there is the source of truth), then sync into this
> repo with `blender_mcp/mcp/_sync_to_farmhand.py`.

# Generated Art Assets

Two generations of art exist here during the transition:

1. **New (Phase 6, current bible):** Rendered directly in Blender via the
   `blender_mcp` project, using a fixed orthographic Stardew Valley-style 3/4
   camera (axis-aligned, NOT a 45-deg-yawed diamond). See `backgrounds/`.
2. **Legacy (Phase 5):** Procedurally generated SVG-based diamond-isometric
   sprites from `generate-sprites.cjs` (Kenney Isometric Miniature Farm style,
   30x45 deg diamond tiles). Being phased out for world/ground art; animal and
   prop replacements are still pending.

## Camera Bible (CURRENT — Stardew-style 3/4, axis-aligned)

This supersedes the diamond-isometric bible below for all newly generated art.

- **Projection:** Orthographic (no perspective distortion), camera tilted
  55 deg down from horizontal, **0 deg yaw** — world X/Y axes stay aligned to
  the screen's horizontal/vertical, giving a rectangular (not diamond) field.
  This is deliberately different from true isometric: do not yaw the camera
  or objects to fake a diamond look.
- **Lighting:** Single fixed warm Sun (energy 1.8, color `(1.0, 0.95, 0.82)`,
  soft 6 deg angular diameter for gentle shadows) + low-strength bright sky-blue
  World fill light (strength 0.35). No per-object lights.
- **Shading:** Flat Diffuse BSDF (or Principled with Roughness=1.0, Specular=0)
  — matte cartoon look, no gloss/reflections/emission.
- **Color management:** `Standard` view transform (not Filmic/AgX) for bright,
  saturated, kid-friendly colors.
- **Resolution:** All renders are `1920x1080`, sharing the exact same camera
  so every asset PNG composites pixel-for-pixel with the background.
- Full spec, exact numeric values, and the render/verification procedure for
  every new asset: see `blender_mcp/mcp/ASSET_STYLE_GUIDE.md` (this is the
  single source of truth; if it and this README ever disagree, the style
  guide wins and this file should be corrected to match).

## Camera Bible (LEGACY — diamond isometric, Kenney Miniature Farm match)

Still describes the existing Phase-5 animal/prop sprite-sheets below until
they're regenerated to the current bible.

- **Projection:** Isometric diamond, 30 deg tilt x 45 deg rotation
- **Lighting:** Top-left highlight, right-face shade (~30-40% darker)
- **Outline:** `#3D2A16`, 1.5-2px weight, round joins
- **Palette:**
  - Sheep: `#f4f0e4` body / `#d4cbb8` shade (cream wool)
  - Duck: `#f0c84a` body / `#d4a22a` shade (yellow)
  - Cow: `#f7f4ea` body / `#d8d0c0` shade (white+dark spots)
  - Chicken: `#fff1c4` body / `#e8d08a` shade (tan+red comb)
  - Pig: `#f7b4c4` body / `#e87898` shade (pink+snout)
  - Soil: `#8a5634` / `#7a4828`
  - Stems/leaves: `#3f8a32` / `#4ea83a` (green)

## Animal Sprite-sheets

6-frame horizontal strip PNGs per animal+action: `animals/{kind}/{action}/spritesheet.png`

- Frame size: **96x96 px** (strip is 576x96 for 6 frames)
- Kinds: `sheep`, `duck`, `cow`, `chicken`, `pig`
- Actions: `walk`, `run`, `eat`, `sit`, `lay`
- Total: 5 kinds × 5 actions × 6 frames = **150 frames**

## Crop Sprites

4 growth-stage PNGs per crop species: `crops/{kind}/stage_{1..4}.png`
Species: `daisy`, `herbs`, `sunflower`, `oak`

## Terrain Tiles (Phase 5)

`tiles/grass.png` — 128×256 isometric diamond with blade detail, two-tone shading (light left, dark right), Kenney-style outline. Pre-loaded by atlas.ts with fallback to dirt recolor.

## Building Props (Phase 5)

`props/store.png` — 256×384 isometric farm store with wood walls, red roof, door, window, chimney, yellow awning "STORE" sign.
`props/barn.png` — 256×400 isometric red barn with white trim, sliding door, cupola, weathervane.
`props/silo.png` — 180×320 isometric cylindrical silo with gray dome roof.

## FX Particles (Phase 5)

`fx/water_drop.png` — 32×32 teardrop for watering-can bursts.
`fx/leaf.png` — 32×32 leaf shape for fertilizer sparkles.
`fx/star.png` — 32×32 gold star for harvest celebration.
`fx/glow.png` — 64×64 radial glow for ready-to-harvest indicators.

## Fallback

If sprites are missing, the runtime `atlas.ts` generates procedural Canvas 2D placeholders.
Generated SVGs are preferred when available. Regenerate by editing `scripts/generate-sprites.cjs`.