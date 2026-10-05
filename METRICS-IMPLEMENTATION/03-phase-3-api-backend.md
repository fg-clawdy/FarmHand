# Phase 3 — API backend: `stars.ts` → `points.ts` and full currency rename

Paste this entire document into a fresh agent session. Work in the repo root
`c:\Users\theha\Documents\GIT\FarmHand`.

## Objective

Rename every backend currency identifier from "stars" to "points", rename
`apps/api/src/stars.ts` → `points.ts`, extract `computePointsFromLedger()` /
`computePointsForPlayer()`, and convert all backend human-readable strings to "points".
`Player.points` is already canonical; the append-only `PointLedgerEvent` (from Phase 2)
is the source of truth for the balance.

**Prerequisites:** Phases 1 and 2 are done (shared `PointWallet`/`computePointsFromLedger`/
`CURRENCY_DISPLAY` exist; Prisma client exposes `pointLedgerEvent`, `pointCost`,
`pointsHeld`, `targetPoints`, `PointLedgerKind`, `PointLedgerEvent`).

## Canonical map (apply exactly)

| Old | New |
|---|---|
| `stars.ts` file | `points.ts` |
| `appendStarEvent` | `appendPointEvent` |
| `starsHeldForPlayer` | `pointsHeldForPlayer` |
| `grantEarnedStars` | `grantEarnedPoints` |
| `backfillStarLedgers` | `backfillPointLedgers` |
| `StarLedgerKind` (type import) | `PointLedgerKind` |
| `StarWallet` (type import) | `PointWallet` |
| `tx.starLedgerEvent` | `tx.pointLedgerEvent` |
| `currentStars` | `points` |
| `heldStars` | `heldPoints` |
| `availableStars` | `availablePoints` |
| `starsHeld` (redemption) | `pointsHeld` |
| `starCost` | `pointCost` |
| `targetStars` | `targetPoints` |
| `filledStars` | `filledPoints` |
| `starsEarned` (review KPI) | `pointsEarned` |
| `spendHeldStars` | `spendHeldPoints` |
| `canAfford(...,starCost)` | `canAfford(..., pointCost)` |

**Leave alone:** `recordOpeningBalance` (no "star" in name), `startingPoints`,
`startingSeeds`, every `start…` identifier, `Chore.legacyPoints`, `StoreRewardEvent`,
`SharedGoalEvent.amount`.

## Canonical public JSON contract (the end-state shapes to produce)

- `publicWallet(wallet)` → `{ points, heldPoints, availablePoints, lifetimeEarned,
  lifetimeEarnedHarvest, lifetimeEarnedGrant, lifetimeEarnedLegacy, lifetimeSpent,
  adjustNet }` (drop the old `currentStars`/`heldStars`/`starsHeld` duplicates).
- `publicSku(row)` → `{ ..., pointCost, ... }`.
- `publicRedemption(row)` → `{ ..., pointCost, pointsHeld, ... }`.
- `PublicSharedGoal`/`ParentSharedGoal` (shared) now expose `targetPoints`/`filledPoints`.
- `playerReview` KPIs → `pointsEarned` (was `starsEarned`).
- Any backend **human-readable string** that said "stars"/"★" now says "points"
  (frontend re-words it back to "stars" in Phase 4 via `CURRENCY_DISPLAY`).

## Step-by-step work

### 1. Rename file `apps/api/src/stars.ts` → `apps/api/src/points.ts`

Rename the file, then inside it:
- Import `PointLedgerKind`, `PointWallet` (instead of `Star…`) from `@farmhand/shared`.
- Rename `appendStarEvent` → `appendPointEvent`; update the body
  `tx.starLedgerEvent.create` → `tx.pointLedgerEvent.create`, and the P2002 catch
  `tx.starLedgerEvent.findUniqueOrThrow` → `tx.pointLedgerEvent.findUniqueOrThrow`.
- Rename `starsHeldForPlayer` → `pointsHeldForPlayer`; `_sum: { starsHeld: true }` →
  `_sum: { pointsHeld: true }`; `agg._sum.starsHeld` → `agg._sum.pointsHeld`.
- `playerWallet` returns `PointWallet`; `tx.starLedgerEvent.findMany` →
  `tx.pointLedgerEvent.findMany`.
- Rewrite `publicWallet` to the canonical shape above (return `points`,
  `heldPoints`, `availablePoints`, and the six lifetime/adjust fields; **remove**
  the old `currentStars`, `heldStars`, `starsHeld` aliases).
- Keep `recordOpeningBalance` name; it now calls `appendPointEvent` with
  `kind: "OPENING_BALANCE"`.
- Add a DB-backed helper used by Phase 5's gate and the reconciliation test:
  ```ts
  import { computePointsFromLedger } from "@farmhand/shared";
  /** Canonical points for a player, computed from the append-only ledger. */
  export async function computePointsForPlayer(tx: Db, playerId: string): Promise<number> {
    const rows = await tx.pointLedgerEvent.findMany({
      where: { playerId },
      select: { kind: true, amount: true },
    });
    return computePointsFromLedger(rows);
  }
  ```

### 2. `apps/api/src/store.ts`

- Update the import from `"./stars.js"` to `"./points.js"` with the new names
  (`appendPointEvent`, `playerWallet`, `publicWallet`, `pointsHeldForPlayer`).
- Update the `@farmhand/shared` import: `canAfford`, `spendHeldPoints` (was
  `spendHeldStars`), `STARTER_STORE_CATALOG` (field `pointCost`).
- Rename `seedStoreCatalog` body `starCost: row.starCost` → `pointCost: row.pointCost`.
- `publicSku`/`publicRedemption`: field names `starCost`→`pointCost`,
  `starsHeld`→`pointsHeld` (both the argument types and the returned object).
- `requestStoreSku`: `sku.starCost` → `sku.pointCost`, `starsHeld: sku.starCost` →
  `pointsHeld: sku.pointCost`, `canAfford(player.points, held, sku.pointCost)`,
  error string "Not enough stars yet…" → "Not enough points yet…".
- Rename `grantEarnedStars` → `grantEarnedPoints` (and its internal `appendStarEvent` →
  `appendPointEvent`, `spendHeldStars` → `spendHeldPoints`).
- Rename `backfillStarLedgers` → `backfillPointLedgers`; update every `appendStarEvent`
  → `appendPointEvent`, `row.starsHeld || row.starCost` → `row.pointsHeld || row.pointCost`,
  `row.starCost` → `row.pointCost`, and `appendRewardEvent` calls (unchanged name).
- Update `playerStore`/`listRewards`/`playerRewardHistory` return plumbing to the new
  `publicWallet`/`publicSku`/`publicRedemption` shapes.

### 3. `apps/api/src/seed.ts`

- Import `{ backfillPointLedgers, seedStoreCatalog }` from `"./store.js"` (was
  `backfillStarLedgers`); import `recordOpeningBalance` from `"./points.js"`.
- `recordOpeningBalance` calls stay (name unchanged, `config.startingPoints` unchanged);
  note `startingPoints` is `start` + `ing` — do **not** rename it.

### 4. Routes

`apps/api/src/routes/admin.ts`
- Import `grantEarnedPoints` from `../store.js` and
  `{ appendPointEvent, playerWallet, publicWallet, recordOpeningBalance, pointsHeldForPlayer }`
  from `../points.js`.
- Update the "Cannot set points below outstanding holds… `${held}★`…" string: say
  `points` / drop the `★`.
- Any other `★`/`stars` in admin strings → `points`.
- Keep `startingPoints`/`startOfToday`/`startOfDaysAgo` untouched.

`apps/api/src/routes/player.ts`
- `appendPointEvent` import from `../points.js`; update the `harvest` earn call and any
  wallet/`star`-shaped usage (the player payload `publicPlayer` returns `points` — verify
  no stray `availableStars`/`heldStars` leak).

`apps/api/src/routes/parent.ts`
- Update wallet/redemption/kid payload field names to the canonical shapes
  (`availablePoints`, `heldPoints`, `pointCost`, `pointsHeld`) — grep the file.

`apps/api/src/routes/sharedGoal.ts`
- `targetStars` → `targetPoints`, `filledStars` → `filledPoints`,
  `availableStars`/`currentStars` → `availablePoints`/`points` in response bodies.
  Update any "stars" copy to "points".

### 5. Remaining backend modules (grep-first, then rename)

Use a **whole-word** grep so `start…` is never matched:
```
Get-ChildItem apps/api/src -Recurse -File -Include *.ts |
  Select-String -Pattern '\b(StarLedger|StarWallet|currentStars|heldStars|availableStars|targetStars|filledStars|starsHeld|starCost|starsEarned|appendStarEvent|starsHeldForPlayer|spendHeldStars|grantEarnedStars|backfillStarLedgers|starLedgerEvent)\b'
```
Fix every hit per the canonical map. Known files to expect:
- `apps/api/src/profile.ts` — `playerWallet`/`publicWallet` import from `./points.js`; the
  harvest activity label `${d.points}★` → `${d.points} points` (or drop the glyph).
- `apps/api/src/sharedGoals.ts` — `targetStars` → `targetPoints`, `filledStars` →
  `filledPoints`, `availableStars`/`currentStars` → points, and "stars" copy → "points".
- `apps/api/src/playerReview.ts` — `starsEarned` → `pointsEarned` (and any "stars" label).
- `apps/api/src/parentStats.ts`, `apps/api/src/adminStats.ts` — any currency `star*`
  field/label → `point*`/`points` (fields like `totalStars` → `totalPoints`).
- `apps/api/src/game.ts`, `apply`/harvest paths — confirm harvest earns call
  `appendPointEvent` with `kind: "EARN_HARVEST"` and `details.points`.

Files whose "star" hits are almost certainly `start…` false positives (confirm, do not
blindly edit): `tz.ts`, `auth.ts`, `avatar.ts`, `choreHeat.ts`, `index.ts`, `jarArt.ts`,
`push.ts`, `selfie.ts`, `wantedFlyer.ts`.

### 6. Tests + smoke script

- `apps/api/src/reconciliation.test.ts` — rewrite the independent `walletFromLedger`
  helper to call the shared `computePointsFromLedger` (or the new
  `computePointsForPlayer(tx, playerId)`), rename `starLedgerEvent` → `pointLedgerEvent`,
  `Star reconciliation` → `Point reconciliation`, and keep the assertion
  `player.points === computedPoints`. Ensure it now also accounts for `GIVE_SHARED` /
  `RETURN_SHARED` (the old helper did not) so shared-goal givers don't false-fail.
- `apps/api/src/noDateNowKeys.test.ts` — update its grep patterns `appendStarEvent` →
  `appendPointEvent` and `StarLedgerEvent` → `PointLedgerEvent`.
- `apps/api/src/sharedGoals.test.ts`, `gameService.test.ts`, `chores.test.ts`,
  `parentChores.test.ts`, `selfie.test.ts`, `adminStats.test.ts` — update any wallet field
  or `star`-currency references per the map.
- `scripts/smoke.mjs` — update every contract assertion that references the old wallet
  shape: `availableStars` → `availablePoints`, `starsHeld` → `pointsHeld`, etc. (keep the
  numeric expectations unchanged).

### 7. Regenerate + typecheck + test

Run from `apps/api`:
```
npx prisma generate
npm run build -w @farmhand/api
npm test -w @farmhand/api
```
Fix all type errors. Grep again for the currency identifiers list above — expect zero.

## Definition of done

- `apps/api` builds clean and its tests pass.
- `apps/api/src/points.ts` exists (no `stars.ts`); it exports `appendPointEvent`,
  `pointsHeldForPlayer`, `playerWallet`, `publicWallet`, `computePointsForPlayer`,
  `recordOpeningBalance`.
- `computePointsFromLedger` (shared) + `computePointsForPlayer` (api) are the single
  source of truth for the balance, and the reconciliation test uses them.
- No backend currency identifier uses "star" anymore, and no backend human-facing string
  says "stars" (all now "points").
- Frontends (Phase 4) remain broken until they are updated — expected, proceed to Phase 4.