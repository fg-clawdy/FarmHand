# Phase 3 — Accolades (v1)

Product source: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Phase 3 — Accolades.

This slice is **shipped** on the compose stack. The real-world store, Sibling Spark, County Fair Champ, star bonuses for badges, Playfield Art crop seating, and farmstead currency stay out of scope.

## What kids get

Playing the existing garden loop (plant, water, harvest, daily selfie, chore photo / approved chore plant) fills counters. Medals and legends show on the garden **🏅 Badges** sheet. Unlocking pops a short celebration. **No extra stars or seeds** come from a badge.

Parents see the same ledger on **Parent → Kids**. Operators see it on **Admin → Accolades**.

## Season rule

A season is a **calendar quarter in `America/Chicago`**.

`seasonKey` looks like `2026-Q3` (July–September). Seasonal counters live on that key. A new quarter starts empty seasonal rows; old seasonal medals stay in history but the garden panel shows the current quarter.

Lifetime legends use season key `lifetime` and **never reset**.

## Seasonal tracks (bronze / silver / gold)

Default steps are **10 / 50 / 100**, except Crop Explorer.

| Slug | Title | Counter | Notes |
| --- | --- | --- | --- |
| `harvests` | Harvester | harvests | Ripe harvests only |
| `waterings` | Rain Maker | waterings | Successful waters |
| `plantings` | Green Thumb | confirmed plants | Pouch plant **or** parent **approve** of a waiting seed. Not a purgatory claim, not a deny |
| `selfies` | Smile Season | first selfie of a Chicago day | Repeat selfies the same day do not increment |
| `crops` | Crop Explorer | distinct harvested kinds | **1 / 2 / 3** (only corn, strawberry, cotton exist) |
| `active-days` | Show-Up | distinct Chicago active days this season | Same day rule as Early Bird |

Bronze is kept when silver and gold unlock.

### What counts as an active day

A Chicago calendar day with any of: harvest, water, confirmed plant, first-of-day selfie, chore photo claim.

Not counted: login, purgatory-only claim, deny, prune, fertilize.

## Lifetime legends (once, forever)

| Slug | Title | Threshold |
| --- | --- | --- |
| `first-harvest` | First Harvest | 1 harvest ever |
| `homestead-helper` | Homestead Helper | 500 lifetime waterings |
| `barn-full` | Barn Full | all three crops harvested ever (corn + strawberry + cotton) |
| `early-bird` | Early Bird | **30 distinct** Chicago active days (not a consecutive streak) |
| `camera-kid` | Camera Kid | watering selfies **plus** chore photo claims ≥ 50 |

Deferred: Sibling Spark, County Fair Champ.

## Schema

Postgres (Prisma):

- `AccoladeCounter` — per player + `seasonKey` (`lifetime` or `2026-Q3`): harvests, waterings, plantings, selfies, chorePhotos, cropsMask
- `AccoladeActiveDay` — per player + Chicago `dayKey`; stores the season of that day
- `AccoladeUnlock` — unique `(playerId, slug, seasonKey, medal)`; lifetime medals are stored as `""` (Postgres unique indexes treat SQL NULL as distinct)

Crop bits: corn = 1, strawberry = 2, cotton = 4. Barn Full when mask is 7.

## Hooks

Atomic with the play action inside the same Prisma transaction:

- harvest → harvest + crop kind
- water → watering
- pouch plant → planting
- chore **approve** → planting
- first selfie of a Chicago day → selfie
- chore claim **with photo** → chore_photo

Then evaluate unlocks; persist new rows; return `unlocks` on the mutation. Unlock handlers must not increment stars or seeds.

## APIs

- `GET /api/accolades` — player session
- `GET /api/parent/accolades` — all active kids
- `GET /api/admin/accolades` — same farm ledger

## How to verify (Willow `1111`)

1. `docker compose up -d --build api player parent admin nginx` (HTTP often `8080` in this repo).
2. Open the player at `/`, tap Willow, PIN `1111`.
3. Plant a T1 (or set T1 duration to 0 in Admin tunables), harvest.
4. Harvest celebration should still be **+25★ / +1 seed** only. A badge toast may also say **First Harvest**. Crop Explorer bronze if this was a new crop this season.
5. Garden top bar **🏅** → Badges: season label (e.g. Jul–Sep 2026), Harvester progress, Forever legends with First Harvest earned and Homestead Helper still locked after a few waters.
6. Parent (`/parent/`, `admin` / `farmhand-dev`) → **Kids**: same medals and legends for Willow.
7. Admin (`/admin/`) → **Accolades**: same list.
8. Repeat harvests to 10 this season → Harvester bronze. Still no extra currency.

```bash
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs
```

Smoke asserts First Harvest after one harvest, Harvester bronze at 10, Homestead Helper not awarded under 500 waters, and harvest still pays 25★ / 1 seed.
