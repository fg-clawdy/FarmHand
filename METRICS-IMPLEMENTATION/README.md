# METRICS-IMPLEMENTATION — Phase Prompts

This directory holds **one self-contained prompt per phase**. Each prompt is written
to be copy/pasted verbatim into a fresh AI agent session and executed to completion on
its own. Agent sessions should run in the repo root:

```
c:\Users\theha\Documents\GIT\FarmHand
```

## The goal (one sentence)

Standardize the in-game currency to backend `points` everywhere, keep **"stars"** as a
cosmetic, UI-only label, and align the metrics pipeline so the single currency is
counted *exactly once*.

## Ordering & dependencies (run strictly in this order)

| # | Document | Scope | Depends on |
|---|----------|-------|-----------|
| 1 | `01-phase-1-shared-package.md` | Canonical `points` types + `currencyDisplay.ts` in `packages/shared` | — |
| 2 | `02-phase-2-prisma-schema-migration.md` | DB enum/table/column renames + hand-written migration | 1 |
| 3 | `03-phase-3-api-backend.md` | `stars.ts` → `points.ts`, all helpers/routes/seed/tests, `computePointsFromLedger()` | 2 |
| 4 | `04-phase-4-frontends.md` | Frontend API types + route all currency display through `CURRENCY_DISPLAY` | 3 |
| 5 | `05-phase-5-metrics-sanitizer.md` | Reconcile-before-publish gate + watermark + `SystemAlert` | 3 (independent of 4, can run in parallel) |
| 6 | `06-phase-6-balance-agent.md` | Venice balance agent: read-only recommendations + parent review/apply workflow | 5 (capstone; needs the full metrics pipeline) |

Phases 1–3 are a hard dependency chain (a rename in one layer breaks the next layer).
Phases 4 and 5 are independent of each other once 3 is done.
Phase 6 is the capstone: it reads the metrics built by 1–5, proposes tuning deltas via Venice AI
(the Jev decision model + a reasoning LLM), and stages them for parent review/apply. The agent is
**read-only** with respect to game data — it writes only its own append-only recommendation tables,
and all real config changes still flow through `saveConfig`.

## Canonical terminology (shared by every phase)

The currency is **points**. "Stars" is only a seasonal/child-facing display label.

| Old (current code) | New (canonical) |
|---|---|
| `starCost` | `pointCost` |
| `starsHeld` (redemption hold) | `pointsHeld` |
| `currentStars` (wallet balance) | `points` |
| `heldStars` (wallet held) | `heldPoints` |
| `availableStars` | `availablePoints` |
| `targetStars` | `targetPoints` |
| `filledStars` | `filledPoints` |
| `starsEarned` (review KPI) | `pointsEarned` |
| `StarLedgerKind` | `PointLedgerKind` |
| `StarLedgerLine` | `PointLedgerLine` |
| `StarWallet` | `PointWallet` |
| `StarLedgerEvent` (table/model) | `PointLedgerEvent` |
| `starLedgerEvent` (Prisma delegate) | `pointLedgerEvent` |
| `availableStars()` | `availablePoints()` |
| `spendHeldStars()` | `spendHeldPoints()` |
| `appendStarEvent()` | `appendPointEvent()` |
| `starsHeldForPlayer()` | `pointsHeldForPlayer()` |
| `backfillStarLedgers()` | `backfillPointLedgers()` |
| `grantEarnedStars()` | `grantEarnedPoints()` |
| `stars.ts` | `points.ts` |

### Do NOT touch (every phase)

- `start…` names: `startingPoints`, `startingSeeds`, `startOfToday`, `startOfDaysAgo`,
  `startedAt`, `restart`, etc. These contain the substring "star" but are unrelated.
- `Chore.legacyPoints` — a separate legacy concept, out of scope.
- Decorative star **graphics/particles/icons** (Pixi star drawings, `★` used as a
  visual motif, celebration effects). Only *currency amounts* flow through
  `CURRENCY_DISPLAY`.
- `Player.points` — already canonical, never rename.
- Historical docs (`docs/*.md`, `PRD_*.md`, `FABLE_ANALYSIS.md`, etc.) — prose, not code.

## Validation rules (apply to every phase)

- Typecheck the affected workspace(s): `npm run build -w @farmhand/shared`, `-w @farmhand/api`, etc.
- Run the affected tests: `npm test -w @farmhand/shared`, `npm test -w @farmhand/api`, etc.
- Full monorepo green is only expected after Phase 3 (for backend) / Phase 4 (for UI).
- Never leave dangling `star*` currency identifiers behind; grep for them at the end.