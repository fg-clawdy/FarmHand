# New Crop Requirements PRD

**Status:** Draft  
**Date:** 2026-09-21  
**Effort:** Art / asset generation (separate from seed-economy implementation)

---

## 1. Goal

Design **2 new crop kinds** (Tomato and Pumpkin) to complete a **5-tier crop ladder**, enabling differentiated seed-cost / point-yield tiers that align with the new chore-to-seed reward system.

The new crops need:
- An emoji, name, and `kind` identifier
- 4 growth stages each (emoji strings + face strings)
- Visual descriptions for each stage (to guide an image-generation pass)
- A fertilizer-reduction value
- A position in the 1–5 tier progression

---

## 2. Current State (3 crops)

| Tier | Kind         | Emoji | Name         | Seed Cost | Duration | Points |
|------|-------------|-------|-------------|-----------|----------|--------|
| 1    | `corn`      | 🌽    | Sweet Corn   | 1         | 24h      | 25★    |
| 2    | `strawberry`| 🍓    | Strawberry   | 1         | 24h      | 25★    |
| 3    | `cotton`    | ☁️    | Cotton       | 1         | 24h      | 25★    |

All three are currently flat (same economy, same duration). The `CROP_KINDS` tuple is `["corn", "strawberry", "cotton"]`.

---

## 3. Target State (5 crops / 5 tiers)

| Tier | Kind         | Emoji | Name             | Seed Cost | Duration  | Points  | Shards |
|------|-------------|-------|-----------------|-----------|-----------|---------|--------|
| 1    | `corn`      | 🌽    | Sweet Corn       | 1         | 24h       | 20★     | 1      |
| 2    | `cotton`    | ☁️    | Cotton           | 2         | 24h       | 40★     | 2      |
| 3    | `tomato`    | 🍅    | Tomato           | 3         | 36h       | 60★     | 3      |
| 4    | `strawberry`| 🍓    | Strawberry       | 4         | 48h       | 80★     | 4      |
| 5    | `pumpkin`   | 🎃    | Pumpkin          | 5         | 72h       | 100★    | 5      |

**Rationale for the ordering:**
- Corn stays tier 1 — the classic starter crop, universally familiar.
- Cotton moves to tier 2 — slightly more niche/specialized than corn.
- Tomato is the new tier 3 — a garden favorite, moderate grow time, kid-friendly.
- Strawberry moves to tier 4 — premium, delicate, high-value.
- Pumpkin is the new tier 5 — large, impressive, longest grow time, biggest payoff.


---

## 4. New Crop Specifications

### 4.1 Tomato (`tomato`) — Tier 3

| Property            | Value                          |
|--------------------|-------------------------------|
| `kind`             | `"tomato"`                     |
| `emoji`            | `"🍅"`                         |
| `name`             | `"Tomato"`                     |
| `seedCost`         | 3                              |
| `durationMinutes`  | 2,160 (36h)                    |
| `points`           | 60                             |
| `fertilizerReductionMinutes` | 360 (6h)                |

#### Growth Stages

| Stage | Emoji | Face | Visual Description (for image gen) |
|-------|-------|------|-------------------------------------|
| 1 (seedling) | `🌱` | `😌` | A small green sprout poking through dark soil in a terracotta pot. Two tiny cotyledon leaves. Bright sunny background. |
| 2 (vegetative) | `🌿` | `🙂` | A knee-high bushy plant with fuzzy green leaves and a wooden stake. Small yellow flower buds beginning to appear. |
| 3 (fruiting) | `🍅` | `😊` | Full tomato plant with 3–4 green tomatoes starting to blush red. Wooden stake and twine ties visible. Garden soil at base. |
| 4 (ripe) | `🍅` | `😄` | A lush tomato plant heavy with 5–6 ripe, glossy red tomatoes. A couple have fallen onto the soil below. Sunlit garden scene. |

---

### 4.2 Pumpkin (`pumpkin`) — Tier 5

| Property            | Value                          |
|--------------------|-------------------------------|
| `kind`             | `"pumpkin"`                    |
| `emoji`            | `"🎃"`                         |
| `name`             | `"Pumpkin"`                    |
| `seedCost`         | 5                              |
| `durationMinutes`  | 4,320 (72h)                    |
| `points`           | 100                            |
| `fertilizerReductionMinutes` | 480 (8h)                |

#### Growth Stages

| Stage | Emoji | Face | Visual Description (for image gen) |
|-------|-------|------|-------------------------------------|
| 1 (seedling) | `🌱` | `😌` | A broad-leafed sprout emerging from a mound of rich dark soil. Two oversized cotyledons. Soft morning light. |
| 2 (vine) | `🌿` | `🙂` | A sprawling vine with large, lobed green leaves and bright yellow/orange trumpet flowers. Tendrils reaching across the soil. A tiny green pumpkin nub visible at one flower base. |
| 3 (green fruit) | `🎃` | `😊` | A large, deeply ribbed green pumpkin sitting on straw. Vine still attached. Leaves beginning to brown at edges. Late-afternoon golden light. |
| 4 (ripe) | `🎃` | `😄` | A massive, fully orange pumpkin with deep ribs. The vine has dried and browned. Harvest-ready with a short cut stem. A small wagon or basket nearby for scale. Autumn warmth. |

---

## 5. Image Generation Requirements

Each crop needs **4 growth-stage images** (PNG, transparent background, 512×512 or 1024×1024).

### Style Guide
- **Style:** 2D illustrated, warm palette, soft shading — consistent with existing corn / strawberry / cotton art.
- **Perspective:** Front-facing or slight three-quarter view, ground-level showing the plant growing from soil.
- **Faces:** Each stage gets a subtle emoji-style face integrated into the plant or a small floating expression bubble (match existing convention).
- **Naming:** `{kind}_stage{1-4}.png` (e.g., `tomato_stage1.png`, `pumpkin_stage4.png`).
- **Format:** PNG, RGBA, at least 512×512.

### Existing Reference Assets
The three existing crops (`corn`, `strawberry`, `cotton`) should be used as visual references for consistency in line weight, color saturation, and face style.

---

## 6. Code Changes Required (enum / type)

In `packages/shared/src/types.ts`, `CROP_KINDS` must expand from 3 to 5 entries:

```ts
// Before
export const CROP_KINDS = ["corn", "strawberry", "cotton"] as const;

// After
export const CROP_KINDS = ["corn", "cotton", "tomato", "strawberry", "pumpkin"] as const;
```

The `cropKindForTier()` helper auto-indexes from this array, so tier-to-kind mapping follows the order above.

The `DEFAULT_GAME_CONFIG.tiers` array in `packages/shared/src/config.ts` must be extended with the two new tier entries (full `PlantTier` objects as specified in §3–§4).

---

## 7. Acceptance Criteria

- [ ] Tomato and pumpkin images generated (4 stages each, 8 total PNGs).
- [ ] Images match the style of existing corn / strawberry / cotton art.
- [ ] Growth-stage visual descriptions in §4.1 and §4.2 are satisfied.
- [ ] `CROP_KINDS` updated to `["corn", "cotton", "tomato", "strawberry", "pumpkin"]`.
- [ ] `DEFAULT_GAME_CONFIG.tiers` extended with tomato (tier 3) and pumpkin (tier 5) entries.
- [ ] Existing tiers re-ordered so corn→cotton→tomato→strawberry→pumpkin maps to tiers 1→5.
- [ ] `cropKindForTier()` returns the correct kind for each tier without code changes.
- [ ] Existing tests that assert 3 tiers or flat economy are updated to match the new 5-tier differentiated table.

---

## 8. Out of Scope (this PRD)

- Implementing the shard system or seed-reward logic (see `CHORE_AND_SEED_PRD.md`).
- Generating chore icons or updating the job board UI.
- Admin config panel changes (handled in the seed-economy implementation).
- Migration of existing player data (handled in the seed-economy implementation).
