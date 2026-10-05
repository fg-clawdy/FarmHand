# Phase 4 — Frontends: consume `points` shapes, render via `CURRENCY_DISPLAY`

Paste this entire document into a fresh agent session. Work in the repo root
`c:\Users\theha\Documents\GIT\FarmHand`.

## Objective

Update the three frontend apps (`apps/player`, `apps/parent`, `apps/admin`) so their API
type contracts use the `points`-canonical shape, and so every **currency-amount label**
renders through the shared `CURRENCY_DISPLAY`/`formatPoints`/`formatPointsNoun` helpers.
The child-facing label stays "★ / stars / star"; the data is "points".

**Prerequisite:** Phase 3 is complete (backend returns `points`, `heldPoints`,
`availablePoints`, `pointsHeld`, `pointCost`, `targetPoints`, `filledPoints`,
`pointsEarned`; `CURRENCY_DISPLAY`/`formatPoints`/`formatPointsNoun` exist in
`@farmhand/shared`).

## Canonical API type changes

Apply to every frontend `api.ts`:

| Old field | New field |
|---|---|
| `currentStars` | `points` |
| `heldStars` | `heldPoints` |
| `availableStars` | `availablePoints` |
| `starsHeld` (redemption) | `pointsHeld` |
| `starCost` | `pointCost` |
| `targetStars` | `targetPoints` |
| `filledStars` | `filledPoints` |
| `starsEarned` (review KPI) | `pointsEarned` |

Specific files:
- `apps/player/src/api.ts` — `ReviewKpis.starsEarned` → `pointsEarned`; the `PlayerStore`
  / `StoreSku` / `SharedGoalPour` types use `pointCost`/`pointsHeld`/`targetPoints`/
  `filledPoints`/`availablePoints`/`heldPoints`/`points`; the `requestStore` response
  redemption `starCost` → `pointCost`. Optionally rename the local action helpers
  `giveStars` → `givePoints` and `putBackStars` → `putBackPoints` (and their call sites);
  this is cosmetic but keeps naming honest.
- `apps/parent/src/api.ts` — `ParentWallet`, `ParentRedemption`, `ParentStoreSku`,
  `SkuWrite` (`pointCost`, `pointsHeld`, `points`, `heldPoints`, `availablePoints`);
  `createSharedGoal` body `targetStars` → `targetPoints`.
- `apps/admin/src/api.ts` — `AdminPlayer.wallet` fields `availableStars`/`heldStars` →
  `availablePoints`/`heldPoints`.

## Rendering rule (the critical part)

A label is **currency** if it prints a numeric points amount; those must go through the
shared helpers:

```ts
import { CURRENCY_DISPLAY, formatPoints, formatPointsNoun } from "@farmhand/shared";
```

- Replace `{n}★` → `{formatPoints(n)}`.
- Replace `{n} stars` / `{n} star` / `Stars` (as a currency heading) →
  `{formatPointsNoun(n)}` / `CURRENCY_DISPLAY.noun` / `CURRENCY_DISPLAY.nounSingular`.
- Replace hardcoded child copy like `"Not enough stars…"` that the UI generates →
  use `CURRENCY_DISPLAY.noun`.

This is the **only** way frontend strings may reference the seasonal "stars" brand. Do
not invent new `★`/`stars` literals.

### Do NOT change (decorative, not currency)

- Pixi star **particles / drawings / icons** (`apps/player/src/pixi/*` — `GardenScene.ts`,
  `draw.ts`, etc.) that visualize an award flying or a decorative motif, regardless of
  how many "star" hits they contain.
- Emoji `⭐`/`★` used purely as an icon/decoration with no numeric amount associated.
- `start…` identifiers, `avatarKind`, etc.

### Where to look (currency render sites)

- `apps/admin/src/pages/PlayerDetailPage.tsx`, `PlayersPage.tsx`, `ActivityPage.tsx`
  (`Totals: … {points} stars`, the `Stars` column header), `ConfigPage.tsx`
  ("Starting stars" label, "25 stars on harvest" hint).
- `apps/parent/src/pages/ActivityPage.tsx`, `InboxPage.tsx`, `SharedGoalsPage.tsx`,
  `StorePage.tsx`.
- `apps/player/src/components/` — `StoreSheet.tsx`, `FamilyJarSheet.tsx`, `StarPour.tsx`,
  `ProfileSheet.tsx`, `PlotSheet.tsx`, `PointsReviewSheet.tsx`, `HarvestCelebration.tsx`,
  `HarvestAcornCelebration.tsx`, `PlantPicker.tsx`, `SeedPouchSheet.tsx`, `SelfieCapture.tsx`,
  `AcornPour.tsx` — replace currency amounts, but leave decorative star graphics alone.
- `apps/player/src/screens/Garden.tsx`, `FarmDashboard.tsx` — any wallet HUD readout.

## File renames (optional but recommended)

- `apps/player/src/components/StarPour.tsx` → `PointPour.tsx`
- `apps/player/src/components/starPourPace.ts` → `pointPourPace.ts`
- `apps/player/src/components/starPourPace.test.ts` → `pointPourPace.test.ts`
  Update any imports accordingly. These are cosmetic component names; the important part
  is that the currency labels *inside* them use `CURRENCY_DISPLAY`.

## Validation

From the repo root:
```
npm run build -w @farmhand/player
npm run build -w @farmhand/parent
npm run build -w @farmhand/admin
npm test -w @farmhand/player
```
(If a frontend has no test script, confirm via `npm run build -w @farmhand/<app>`.)

Then verify no currency field name remains on the frontends:
```
Get-ChildItem apps/player/src,apps/parent/src,apps/admin/src -Recurse -File -Include *.ts,*.tsx |
  Select-String -Pattern '\b(availableStars|heldStars|starsHeld|currentStars|starCost|targetStars|filledStars|starsEarned)\b'
```
Expect **zero** hits.

## Definition of done

- All three frontends build clean.
- Frontend API types are `points`-canonical.
- Every currency amount in the UI renders through `CURRENCY_DISPLAY` / `formatPoints` /
  `formatPointsNoun`; a grep for `\d★` and `\d stars` in `.tsx` should show only the
  helpers' own output (the shared `currencyDisplay.ts`).
- Decorative star graphics/particles are untouched.
- The player's wallet HUD, store, family jar, and admin/parent wallets display correctly
  (spot-check the running app if possible).