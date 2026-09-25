# Chore & Seed Economy PRD

**Status:** Draft  
**Date:** 2026-09-21  
**Effort:** Full-stack implementation (schema, API, player UI, admin panel, KPI telemetry)

---

## Table of Contents

1. [Goal](#1-goal)
2. [Current State (v1)](#2-current-state-v1)
3. [Target State](#3-target-state)
4. [Chore Difficulty Ranking](#4-chore-difficulty-ranking)
5. [Seed-Reward Mapping](#5-seed-reward-mapping)
6. [5-Tier Crop System](#6-5-tier-crop-system)
7. [Shard Mechanic](#7-shard-mechanic)
8. [Points-per-Seed Calibration](#8-points-per-seed-calibration)
9. [Schema Changes](#9-schema-changes)
10. [Config Changes](#10-config-changes)
11. [API Changes](#11-api-changes)
12. [UI Changes](#12-ui-changes)
13. [KPI / Telemetry](#13-kpi--telemetry)
14. [Migration Plan](#14-migration-plan)
15. [Acceptance Criteria](#15-acceptance-criteria)

---

## 1. Goal

Replace the flat seed economy — where every chore grants 1 seed and every harvest returns 1 seed — with a **differentiated chore‑to‑seed reward system** backed by a **5‑tier crop ladder** and a **shard (fractional seed) accumulator**. The new system ensures:

- Harder chores pay more seeds, so kids are motivated to tackle bigger jobs.
- Harvests yield points proportional to the seed investment (20★ per seed).
- Harvests refund **shards** (fractional seeds), not full seeds — breaking the "plant 1, harvest +1 → infinite seeds" loop.
- Parents can tune every dial: difficulty bands, shards‑per‑seed, tier economy.

---

## 2. Current State (v1)

### 2.1 Chore Rewards
- Every chore claim grants exactly **1 provisional seed** (`JOB_BOARD_V1_REWARD_SEED_COUNT = 1`).
- `rewardSeedCount` is not stored on chores; it's a constant applied at claim time.
- 21 chores in the catalog, 1 inactive (`set-out-school-clothes`).

### 2.2 Crop Economy
- 3 crops, all flat: 1 seed cost, 24h duration, 25★ points.
- `harvestSeedReturn = 1` (full seed refund on every harvest).
- Seed‑neutral loop: plant 1 seed → harvest 25★ + 1 seed → replant forever.

### 2.3 Problem
- Kids can farm points indefinitely with zero chore activity after the first plant.
- No incentive to pick harder chores over easy ones.
- Store prices are untethered from actual effort.

---

## 3. Target State

| Aspect            | v1 (Current)                     | v2 (Target)                                |
|-------------------|----------------------------------|--------------------------------------------|
| Chore reward      | Always 1 seed                    | 1–5 seeds based on difficulty band         |
| Crop tiers        | 3 flat tiers                     | 5 differentiated tiers                     |
| Points per seed   | 25★ (implicit)                   | **20★ per seed** (explicit, per tier)      |
| Harvest refund    | +1 seed always                   | +N shards (1 shard per seed of the crop)   |
| Shards per seed   | N/A                              | 10 (admin‑tunable)                         |
| Seed‑neutral loop | Yes (exploitable)                | No (max 50% refund on the hardest crop)    |

---

## 4. Chore Difficulty Ranking

All 21 chores ranked on a **1–10 difficulty scale**, with parent‑provided corrections applied.

| # | Slug | Title | Difficulty | Band | Seed Reward |
|---|------|-------|-----------|------|-------------|
| 1 | `make-your-bed` | Make your bed | 1 | A | 1 seed |
| 2 | `brush-teeth-am` | Brush Teeth A.M. | 2 | A | 1 seed |
| 3 | `brush-teeth-bedtime` | Brush Teeth Bedtime | 2 | A | 1 seed |
| 4 | `clean-table` | Clean Table | 2 | A | 1 seed |
| 5 | `set-out-school-clothes` | Set Out School Clothes | 2 | A | 1 seed *(inactive)* |
| 6 | `brush-your-hair` | Brush Your Hair | 3 | B | 2 seeds |
| 7 | `clean-shoe-room` | Clean Shoe Room | 3 | B | 2 seeds |
| 8 | `dishes-1-6` | Dishes (1/6) | 4 | B | 2 seeds |
| 9 | `take-out-trash` | Take Out Trash | 4 | B | 2 seeds |
| 10 | `feed-dog-am` | Feed Dog A.M. | 4 | B | 2 seeds |
| 11 | `feed-dog-pm` | Feed Dog P.M. | 4 | B | 2 seeds |
| 12 | `clean-dining-room` | Clean Dining Room | 4 | B | 2 seeds |
| 13 | `clean-formal-dining` | Clean Formal Dining | 4 | B | 2 seeds |
| 14 | `clean-your-room` | Clean Your Room | 4 | B | 2 seeds |
| 15 | `put-up-clean-laundry` | Put Up Clean Laundry | 5 | C | 3 seeds |
| 16 | `easy-bedtime` | Easy Bedtime | 6 | C | 3 seeds |
| 17 | `clean-living-room` | Clean Living Room | 7 | D | 4 seeds |
| 18 | `clean-formal-living` | Clean Formal Living | 7 | D | 4 seeds |
| 19 | `walk-the-dog` | Walk the Dog | 7 | D | 4 seeds |
| 20 | `sweep-and-vacuum-downstairs` | Sweep and Vacuum | 9 | E | 5 seeds |


---

## 5. Seed-Reward Mapping

Difficulty bands map to seed rewards. The mapping is a **global config tunable** so parents can tighten or loosen the economy without redeploying.

| Band | Difficulty Range | Seed Reward | Example Chores in Band |
|------|-----------------|-------------|------------------------|
| A | 1–2 | 1 seed | Make Bed, Brush Teeth, Clean Table |
| B | 3–4 | 2 seeds | Brush Hair, Dishes, Trash, Feed Dog |
| C | 5–6 | 3 seeds | Laundry, Easy Bedtime |
| D | 7–8 | 4 seeds | Living Rooms, Walk Dog |
| E | 9–10 | 5 seeds | Sweep/Vacuum, Mop |

**Design notes:**
- Band E (5 seeds) is the cap — no chore can reward more than 5 seeds.
- Band A (1 seed) is the floor — even the simplest chore is worth planting.
- The band thresholds (`[2, 4, 6, 8, 10]`) are stored as an admin‑editable array `seedRewardBandUpperBounds: [2, 4, 6, 8, 10]` so parents can shift bands without touching individual chore difficulties.
- `Set Out School Clothes` is **inactive** (`isActive: false`). It keeps its difficulty rating (2) but does not appear on the job board. If re‑activated, it earns 1 seed.

### Config shape (new `GameConfig` fields)

```ts
/** Upper bound (inclusive) of each seed-reward band. Length = number of bands. */
seedRewardBandUpperBounds: number[];  // default [2, 4, 6, 8, 10]

/** Seeds rewarded for a chore whose difficulty falls into each band. */
seedRewardBandPayouts: number[];      // default [1, 2, 3, 4, 5]
```

The reward for a difficulty `d` is `payouts[i]` where `i` is the smallest index with `d <= bounds[i]`. A difficulty above the last bound gets the last payout.

| 21 | `mop-the-downstairs` | Mop the Downstairs | 9 | E | 5 seeds |

**Corrections applied:**
- Trash, Feed Dog → difficulty 4 (not lower).
- Easy Bedtime → difficulty 6 (not 3–4).
- Living Rooms, Walk Dog → difficulty 7 (not 5–6).
- Sweep/Vacuum, Mop → difficulty 9 (not 7–8).


---

## 6. 5-Tier Crop System

Each tier corresponds to a seed‑cost level, directly matching the seed‑reward bands.

| Tier | Crop Kind    | Emoji | Seed Cost | Duration | Points (20★/seed) | Shards on Harvest |
|------|-------------|-------|-----------|----------|-------------------|-------------------|
| 1    | `corn`      | 🌽    | 1         | 24h      | 20★               | 1                 |
| 2    | `cotton`    | ☁️    | 2         | 24h      | 40★               | 2                 |
| 3    | `tomato`    | 🍅    | 3         | 36h      | 60★               | 3                 |
| 4    | `strawberry`| 🍓    | 4         | 48h      | 80★               | 4                 |
| 5    | `pumpkin`   | 🎃    | 5         | 72h      | 100★              | 5                 |

**Key invariants:**
- `points = seedCost × 20` (the 20★/seed calibration).
- `shardsEarned = seedCost` (1 shard per seed invested).
- Duration scales gently: 24h → 24h → 36h → 48h → 72h. The jump at tier 3+ gives kids a reason to care about crop choice beyond just seed cost.
- Fertilizer reduction scales with tier: 4h → 5h → 6h → 7h → 8h.


**Gaps:** No chores at difficulty 8 or 10. These are reserved for future chore additions.



---

## 7. Shard Mechanic

### 7.1 Overview

Shards are fractional seeds. They decouple the harvest refund from the full‑seed economy, making the passive loop a slow leak rather than a self‑sustaining engine.

| Concept | Value | Tunable? |
|---------|-------|----------|
| `Player.seedShards` | Accumulator (integer) | No — DB column |
| `GameConfig.shardsPerSeed` | How many shards = 1 full seed | Yes (default 10) |
| Harvest shard yield | `tier.seedCost` shards | No — derived |
| Max refund rate | 5/10 = 50% (tier 5 crop) | Implicit from shardsPerSeed |

### 7.2 Harvest Flow

```
1. Player harvests a tier‑N crop (seedCost = N).
2. Player receives N shards (player.seedShards += N).
3. Player receives tier.points (N × 20★).
4. If player.seedShards >= config.shardsPerSeed:
   a. Player.seeds += 1
   b. Player.seedShards -= config.shardsPerSeed
   c. Repeat (while loop — handles edge case of >2× threshold).
5. Activity log records: points, seedCost, shardsEarned, seedsConverted.
```

### 7.3 Math Check

| Crop Tier | Seed Cost | Shards Earned | Refund Rate (shardsPerSeed=10) |
|-----------|-----------|---------------|-------------------------------|
| 1 (corn) | 1 | 1 | 10% |
| 2 (cotton) | 2 | 2 | 20% |
| 3 (tomato) | 3 | 3 | 30% |
| 4 (strawberry) | 4 | 4 | 40% |
| 5 (pumpkin) | 5 | 5 | 50% |


---

## 8. Points-per-Seed Calibration

**Decision:** 1 seed = **20 points (★)**.

### 8.1 Why 20?

- Clean, round number for parent mental math ("vacuuming = 5 seeds = 100★, a popsicle = 50★ = 2.5 seeds").
- Makes store pricing intuitive: divide star cost by 20 to get "seeds of effort."
- Slightly lower than the legacy 25★/seed, preventing inflation when crops become differentiated.
- Pairs naturally with the 5‑tier ladder: 20→40→60→80→100.

### 8.2 Store Price Re‑anchoring

Existing store SKUs should be reviewed against the new 20★/seed baseline:

| SKU | Current ★ Cost | Seeds @ 20★/seed | Recommendation |
|-----|---------------|-------------------|----------------|
| Popsicle | ~50★ | 2.5 | Round to 40★ (2 seeds) or 60★ (3 seeds) |
| Happy Meal | ~200★ | 10 | Keep at 200★ (10 seeds) — aspirational |
| *(others)* | TBD | TBD | Audit all store items in a follow‑up pass |

Store prices are outside this PRD's scope but must be re‑anchored in a follow‑up pass before launch.


---

## 9. Schema Changes

### 9.1 Prisma Schema (`apps/api/prisma/schema.prisma`)

**Player model — add:**
```prisma
model Player {
  // ... existing fields ...
  seedShards   Int   @default(0)   // NEW: fractional seed accumulator
}
```

**Chore model — add:**
```prisma
model Chore {
  // ... existing fields ...
  difficulty    Int?              // NEW: 1–10 difficulty rating
  seedReward    Int?              // NEW: overrides band-derived reward (null = use band)
}
```

### 9.2 TypeScript Types (`packages/shared/src/types.ts`)

**`GameConfig` — add:**
```ts
export type GameConfig = {
  // ... existing fields ...
  harvestSeedReturn: number;          // DEPRECATED — keep for migration, ignore at runtime
  shardsPerSeed: number;              // NEW: default 10
  seedRewardBandUpperBounds: number[]; // NEW: default [2, 4, 6, 8, 10]
  seedRewardBandPayouts: number[];     // NEW: default [1, 2, 3, 4, 5]
};
```

**`SeedChore` — add:**
```ts
export type SeedChore = {
  // ... existing fields ...
  difficulty: number | null;   // NEW: 1–10
  seedReward: number | null;   // NEW: per-chore override
};
```

**`FarmPlayerCard` — add:**
```ts
export type FarmPlayerCard = {
  // ... existing fields ...
  seedShards: number;  // NEW
};
```



---

## 10. Config Changes

### 10.1 `DEFAULT_GAME_CONFIG` (`packages/shared/src/config.ts`)

New default values:
```ts
export const DEFAULT_GAME_CONFIG: GameConfig = {
  // ... existing fields unchanged ...
  harvestSeedReturn: 1,                     // DEPRECATED — ignored at runtime
  shardsPerSeed: 10,                        // NEW
  seedRewardBandUpperBounds: [2, 4, 6, 8, 10],  // NEW
  seedRewardBandPayouts: [1, 2, 3, 4, 5],       // NEW
  tiers: [ /* 5-tier differentiated table — see §6 */ ],
};
```

### 10.2 `mergeGameConfig()` Updates

The merge function must:
1. Accept and preserve `shardsPerSeed`, `seedRewardBandUpperBounds`, `seedRewardBandPayouts`.
2. Validate: `shardsPerSeed` ≥ 1; band arrays same length; bounds strictly ascending; payouts ≥ 1.
3. Coerce invalid values to defaults rather than crashing.
4. Keep `harvestSeedReturn` in the merged object for backward compat but **never read it at runtime**.
5. On legacy boot (existing DB has old 3‑tier flat economy), auto‑upgrade to the 5‑tier differentiated table (same logic as the existing `isLegacyTierEconomy` check).

### 10.3 Admin Config Panel (`apps/admin/src/pages/ConfigPage.tsx`)

Add editable fields:
- **Shards per seed** — integer input, min 1, max 100.
- **Seed reward band upper bounds** — comma‑separated integer list (e.g., "2, 4, 6, 8, 10").
- **Seed reward band payouts** — comma‑separated integer list, same length as bounds.

Remove or disable the `harvestSeedReturn` field (keep for migration visibility, mark as deprecated).



---

## 11. API Changes

### 11.1 Harvest Route (`apps/api/src/routes/player.ts`)

**Current (v1):**
```ts
// Increment points and seeds
points: { increment: tier.points },
seeds: { increment: config.harvestSeedReturn },
// Log: points, seedsReturned
```

**New (v2):**
```ts
// Calculate shards earned
const shardsEarned = tier.seedCost;

// Increment points and shards
points: { increment: tier.points },
seedShards: { increment: shardsEarned },

// After update, read back seedShards and convert to seeds if threshold met
let seedsConverted = 0;
let remainingShards = player.seedShards + shardsEarned;
while (remainingShards >= config.shardsPerSeed) {
  seedsConverted += 1;
  remainingShards -= config.shardsPerSeed;
}
if (seedsConverted > 0) {
  // Second update: increment seeds, set shards to remainder
  seeds: { increment: seedsConverted },
  seedShards: remainingShards,  // set, not increment
}

// Log: points, tier, shardsEarned, seedsConverted, seedCost
```

**Reward shape returned to client:**
```ts
reward: {
  points: tier.points,
  seedCost: tier.seedCost,
  shardsEarned: shardsEarned,
  seedsConverted: seedsConverted,  // 0 or 1 (rarely >1)
  emoji: tier.emoji,
  name: tier.name,
  kind: tier.kind,
}
```

### 11.2 Chore Seed Route (`apps/api/src/chores.ts`)

**`seedChoreCatalog()` — update:**
- Write `difficulty` and `seedReward` fields from the `CHORE_CATALOG` into the DB `Chore` rows.
- Existing chores without these fields get `difficulty = null, seedReward = null` (migration safe).

**Chore claim reward calculation:**
```ts
function resolveSeedReward(chore: Chore, config: GameConfig): number {
  if (chore.seedReward != null) return chore.seedReward;  // per‑chore override
  if (chore.difficulty == null) return 1;                  // legacy fallback
  const d = chore.difficulty;
  for (let i = 0; i < config.seedRewardBandUpperBounds.length; i++) {
    if (d <= config.seedRewardBandUpperBounds[i]) {
      return config.seedRewardBandPayouts[i];
    }
  }
  return config.seedRewardBandPayouts[config.seedRewardBandPayouts.length - 1];
}
```

This replaces the hardcoded `JOB_BOARD_V1_REWARD_SEED_COUNT`.


---

## 12. UI Changes

### 12.1 Job Board Wanted Posters (`apps/player/src/pixi/jobBoard.ts`)

- `formatJobBoardReward()` already handles pluralization and variable `rewardSeedCount`. No code change needed — it will display "Reward: 3 seeds" automatically when the API returns the new count.
- Update `PLACEHOLDER_WANTED_JOBS` to use realistic reward counts (e.g., dishes → 2, walk dog → 4).

### 12.2 Farm Dashboard (`apps/player/src/screens/FarmDashboard.tsx`)

- Add a **seed‑shard meter** (e.g., a progress bar or greyscale‑to‑color seed icon) showing `seedShards / shardsPerSeed` fill level.
- Visual: a seed icon that fills with color as shards accumulate. When full (shardsPerSeed reached), it "pops" into a full seed with a brief animation, then resets.
- Tooltip: "3/10 shards — harvest 7 more to earn a seed!"

### 12.3 Harvest Celebration (`apps/player/src/components/HarvestCelebration.tsx`)

- Update to display the new reward shape:
  - Points earned (e.g., "+60★")
  - Shards earned (e.g., "+3 shards")
  - If a seed was converted, show "+1 seed!" with emphasis.
- Keep existing star animation; add a shard‑to‑seed conversion animation when `seedsConverted > 0`.

### 12.4 Plant Picker

- Show tier information: seed cost, duration, points yield, and shard return so kids can make informed choices.
- Sort/group by tier (1→5) so harder chores naturally lead to higher‑tier plants.

### 12.5 Admin Chore Catalog (`apps/admin/`)

- Add `difficulty` (1–10 slider or dropdown) and `seedReward` (nullable integer) columns to the chore editor.
- Show derived seed reward based on difficulty + current band config.
- Add a "Recalculate All Rewards" button that reapplies the band mapping to all chores with `seedReward = null`.


### 11.3 Admin Stats (`apps/api/src/adminStats.ts`)



---

## 13. KPI / Telemetry

### 13.1 New Activity Log Fields

Extend the `harvest` activity log `details` JSON:
```json
{
  "slot": 3,
  "tier": 4,
  "points": 80,
  "seedCost": 4,
  "shardsEarned": 4,
  "seedsConverted": 0
}
```

### 13.2 Admin Stats Dashboard

Add to `GET /api/admin/stats`:
```ts
{
  seedsFromChores: number;       // total seeds awarded via chore claims
  seedsFromShards: number;       // total seeds converted from shard accumulation
  shardsEarnedTotal: number;     // lifetime shards earned across all harvests
  avgShardsPerHarvest: number;   // mean shards per harvest event
  claimsByBand: {                // chore claims grouped by seed‑reward band
    bandA: number;  // 1‑seed chores
    bandB: number;  // 2‑seed chores
    bandC: number;  // 3‑seed chores
    bandD: number;  // 4‑seed chores
    bandE: number;  // 5‑seed chores
  };
  completionRateByBand: {        // approved claims / total claims per band
    bandA: number;
    bandB: number;
    // ...
  };
}
```

### 13.3 Parent‑Facing Balance Review

Add to the admin Balance page:
- **Seed sources pie chart:** chores vs. shards vs. starting/grant.
- **Band engagement:** which difficulty bands are kids actually claiming?
- **Seed drain rate:** seeds planted per day vs. seeds earned per day (should be net‑negative for passive‑only play).


---

## 14. Migration Plan

### 14.1 Phase 1: Schema + Config (no behavioral change)

1. Run Prisma migration to add `seedShards` (Player) and `difficulty`/`seedReward` (Chore) columns — all nullable with defaults.
2. Deploy updated `DEFAULT_GAME_CONFIG` with new fields but keep `tiers` flat (3 crops, 1 seed / 25★) so existing behavior is unchanged.
3. Seed `CHORE_CATALOG` difficulties into DB. Existing claims continue to use `JOB_BOARD_V1_REWARD_SEED_COUNT = 1` until Phase 2.

### 14.2 Phase 2: Enable Differentiated Economy

1. Update `mergeGameConfig` to detect legacy flat tiers and auto‑upgrade to the 5‑tier differentiated table on next admin save or server restart.
2. Switch chore claim logic from `JOB_BOARD_V1_REWARD_SEED_COUNT` to `resolveSeedReward()`.
3. Switch harvest logic from `harvestSeedReturn` to shard accumulation.
4. Update all UI surfaces.

### 14.3 Phase 3: Cleanup

1. Remove `JOB_BOARD_V1_REWARD_SEED_COUNT` constant.
2. Remove `harvestSeedReturn` from `GameConfig` type (or keep as ignored legacy field).
3. Remove `FLAT_TIER_POINTS` / `FLAT_TIER_SEED_COST` constants.
4. Update smoke tests to validate 5‑tier economy.

### 14.4 Rollback Safety

- The `harvestSeedReturn` field is preserved in config JSON so a rollback deploy restores v1 behavior.
- `seedShards` defaults to 0 — zero‑impact if the column exists but the code doesn't read it.
- `difficulty` and `seedReward` on Chore are nullable — nulls fall back to the v1 1‑seed constant.


---

## 15. Acceptance Criteria

### 15.1 Economy Correctness
- [ ] Chore difficulty 1–2 grants 1 seed; 3–4 grants 2; 5–6 grants 3; 7–8 grants 4; 9–10 grants 5.
- [ ] Per‑chore `seedReward` override takes precedence over band‑derived reward.
- [ ] Harvesting a tier‑N crop yields exactly N shards.
- [ ] Harvesting a tier‑N crop yields exactly N × 20 points.
- [ ] When `seedShards >= shardsPerSeed`, exactly 1 seed is credited and shards reset.
- [ ] `harvestSeedReturn` is never read at runtime (the shard system replaces it).
- [ ] A child with only planted crops and zero chore activity will run out of seeds.

### 15.2 Config Tunability
- [ ] Admin can change `shardsPerSeed` and see the effect on the next harvest.
- [ ] Admin can change band bounds/payouts and see updated reward counts on the job board.
- [ ] Invalid config values (negative, mismatched array lengths) are coerced to safe defaults.

### 15.3 UI
- [ ] Job board posters show correct seed reward count per chore.
- [ ] Farm dashboard shows shard meter with fill level.
- [ ] Harvest celebration shows shards earned and seed‑conversion pop.
- [ ] Plant picker shows tier info (cost, duration, points, shards).

### 15.4 Telemetry
- [ ] Admin stats show seeds‑from‑chores vs. seeds‑from‑shards split.
- [ ] Admin stats show per‑band claim counts and completion rates.
- [ ] Harvest activity logs include shard and seed‑conversion details.

### 15.5 Backward Compatibility
- [ ] Existing player data migrates cleanly (seedShards = 0, no disruption).
- [ ] Legacy 3‑tier flat config auto‑upgrades to 5‑tier differentiated on boot.
- [ ] Rollback to v1 deploy restores flat economy without data loss.
- [ ] All existing tests pass (or are updated to reflect new defaults).
