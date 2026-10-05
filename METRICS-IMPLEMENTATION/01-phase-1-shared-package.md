# Phase 1 — Canonical `points` types & `currencyDisplay.ts` in `packages/shared`

Paste this entire document into a fresh agent session. Work in the repo root
`c:\Users\theha\Documents\GIT\FarmHand`.

## Objective

Rename the currency data contracts in `packages/shared` from "stars" to "points", and
add the single `CURRENCY_DISPLAY` object through which every frontend will later render
the child-facing "stars" label. No database, no API, no frontend changes in this phase.
Downstream workspaces (api/player/parent/admin) will break type-checking until Phases 2–4
— that is expected and acceptable.

## Canonical mapping (apply exactly)

| Old | New |
|---|---|
| `StarterStoreSku.starCost` | `StarterStoreSku.pointCost` |
| `StarLedgerKind` | `PointLedgerKind` |
| `StarLedgerLine` | `PointLedgerLine` |
| `StarWallet` | `PointWallet` |
| `StarWallet.currentStars` | `PointWallet.points` |
| `StarWallet.heldStars` | `PointWallet.heldPoints` |
| `StarWallet.availableStars` | `PointWallet.availablePoints` |
| `availableStars(current, held)` | `availablePoints(points, heldPoints)` |
| `canAfford(..., starCost)` | `canAfford(..., pointCost)` |
| `spendHeldStars(current, held)` | `spendHeldPoints(points, heldPoints)` |
| `PublicSharedGoal.targetStars` | `PublicSharedGoal.targetPoints` |
| `PublicSharedGoal.filledStars` | `PublicSharedGoal.filledPoints` |
| `ParentSharedGoal.targetStars` | `ParentSharedGoal.targetPoints` |
| `ParentSharedGoal.filledStars` | `ParentSharedGoal.filledPoints` |
| `SHARED_GOAL_STARTERS[].targetStars` | `SHARED_GOAL_STARTERS[].targetPoints` |

`walletFromLedger` keeps its name (it returns a `PointWallet`). The lifetime fields
(`lifetimeEarned`, `lifetimeEarnedHarvest`, `lifetimeEarnedGrant`, `lifetimeEarnedLegacy`,
`lifetimeSpent`, `lifetimeGiven`, `adjustNet`) contain no "star" and **do not change**.

## Step-by-step work

### 1. `packages/shared/src/store.ts`

- Rename everything per the mapping table above.
- In `StarterStoreSku`, rename the field and update every entry in
  `STARTER_STORE_CATALOG` (`starCost: N` → `pointCost: N`).
- Rename the three functions; reorder the params so `points` is the balance and
  `heldPoints` is the held amount (`availablePoints(points, heldPoints)`,
  `canAfford(points, heldPoints, pointCost)`, `spendHeldPoints(points, heldPoints)`).
- `PointWallet` shape is:
  ```ts
  export type PointWallet = {
    points: number;
    heldPoints: number;
    availablePoints: number;
    lifetimeEarned: number;
    lifetimeEarnedHarvest: number;
    lifetimeEarnedGrant: number;
    lifetimeEarnedLegacy: number;
    lifetimeSpent: number;
    lifetimeGiven: number;
    adjustNet: number;
  };
  ```
- Extract the `currentStars` computation inside `walletFromLedger` into a pure helper:
  ```ts
  /** Canonical points balance from an append-only ledger. Single source of truth. */
  export function computePointsFromLedger(lines: PointLedgerLine[]): number;
  ```
  It must reproduce exactly the existing math: sum `EARN_HARVEST`, `EARN_GRANT`,
  `OPENING_BALANCE` and signed `ADJUST_ADMIN` into `lifetimeEarned`/`adjustNet`, subtract
  `SPEND_REWARD` into `lifetimeSpent`, add `GIVE_SHARED` / subtract `RETURN_SHARED` into
  `lifetimeGiven` (clamped `Math.max(0, …)`), then return
  `Math.max(0, lifetimeEarned + adjustNet - lifetimeSpent - given)`. Have
  `walletFromLedger` call `computePointsFromLedger` so there is exactly one definition of
  the balance. (This function is what Phase 5's reconciliation gate will reuse — get it
  right now.)

### 2. `packages/shared/src/sharedGoals.ts`

- Rename `targetStars` → `targetPoints` and `filledStars` → `filledPoints` in
  `PublicSharedGoal` and `ParentSharedGoal`.
- Update `SHARED_GOAL_STARTERS` entries to use `targetPoints`.
- Update the `usdTarget`/`usdFilled` doc comments ("targetPoints / 100").
- Leave `SHARED_GOAL_COPY` prose as-is — it is cosmetic child-facing copy and contains
  literal "stars"; it is **not** a data contract.

### 3. New file: `packages/shared/src/currencyDisplay.ts`

This is the **only** place the seasonal "stars" brand is allowed to live in UI code.
Create it with:
```ts
export type CurrencyDisplay = {
  symbol: string;        // "★"
  noun: string;          // "stars"
  nounSingular: string;  // "star"
};

/** Cosmetized currency label. Backend canonical currency is always "points". */
export const CURRENCY_DISPLAY: CurrencyDisplay = {
  symbol: "★",
  noun: "stars",
  nounSingular: "star",
};

/** e.g. formatPoints(500) -> "500★" */
export function formatPoints(points: number): string {
  return `${points}${CURRENCY_DISPLAY.symbol}`;
}

/** e.g. formatPointsNoun(1) -> "1 star"; formatPointsNoun(500) -> "500 stars" */
export function formatPointsNoun(points: number): string {
  const noun = Math.abs(points) === 1 ? CURRENCY_DISPLAY.nounSingular : CURRENCY_DISPLAY.noun;
  return `${points} ${noun}`;
}
```
Match the existing style of the repo (single quotes, no trailing semicolon surprises) —
inspect surrounding files first.

### 4. `packages/shared/src/store.test.ts`

- Update every reference: `availableStars` → `availablePoints`, `canAfford(...starCost)`
  → `pointCost`, `spendHeldStars` → `spendHeldPoints`, `wallet.availableStars` →
  `wallet.availablePoints`, `wallet.currentStars` → `wallet.points`, `starCost` →
  `pointCost`, `heldStars` args → `heldPoints`.
- Keep all assertions' *values* identical; only rename identifiers. Do not weaken any test.

### 5. `packages/shared/src/index.ts`

- Add `export * from "./currencyDisplay.js";` in alphabetical position with the other
  `export *` lines.

## Do not touch

- `config.ts` `startingPoints`, `tier.points` — already correct (`points`).
- `types.ts`, `engine.ts`, `choreCatalog.ts`, `seedSpend.ts` unless a grep shows a
  currency `star*` identifier (use the canonical mapping; `start*` is out of scope).
- Any `*.test.ts` other than `store.test.ts`.

## Validation

1. `npm run build -w @farmhand/shared` — must compile clean.
2. `npm test -w @farmhand/shared` — all tests green.
3. Grep `packages/shared/src` for
   `StarLedger|StarWallet|currentStars|heldStars|availableStars|targetStars|filledStars|starCost|spendHeldStars`
   — expect **zero** currency hits (the word "star" may still appear in `SHARED_GOAL_COPY`
   prose and comments, which is fine).

## Definition of done

- `packages/shared` compiles and its tests pass with the `points`-canonical names above.
- `computePointsFromLedger` exists and is the only definition of the balance math.
- `currencyDisplay.ts` exists with `CURRENCY_DISPLAY`, `formatPoints`, `formatPointsNoun`.