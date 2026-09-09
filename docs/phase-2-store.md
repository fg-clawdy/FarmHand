# Phase 2 — Real-world stars store (starter)

Product source of truth: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Economy (LOCKED) starter store + § Phase 2 — Real store.

Kids **request** real-world rewards with **stars**. A parent **approves or denies** in the Parent PWA. Approve means the kid **owns** the promise; later a parent **marks it redeemed** when it actually happens. Nothing auto-buys Amazon/Netflix. Farmstead / digital SKUs stay out of scope.

The Farm Store stays **transactional**: Shop + Waiting + Owned (actionable). Full history, lifetime totals, and accolades live on the kid **Profile**: [`phase-2-kid-profile.md`](phase-2-kid-profile.md).

Push helpers already existed; this slice **wires** them. Same Approve/Deny + clear-across-parents pattern as chores: [`phase-2-parent-push.md`](phase-2-parent-push.md). Old `/fulfill` and SW `fulfill` actions still map to **approve**.

## Product locks

- Currency is **stars only**. **1★ = 1¢**. Stars are earned from **harvest** (and explicit grants). Admin SET is an adjustment, not gameplay-earned.
- Kid requests from the **player Farm Store** building.
- Parent approve is a **real-world promise** (ice cream is bought, movie night happens). Primary UI is **Parent PWA**, not Admin.
- No auto-purchase integrations.

Starter catalog (seeded create-if-missing, like chores — parent edits persist across API restarts):

| Reward | Stars | USD at peg |
| --- | --- | --- |
| Movie night | 200★ | $2.00 |
| Ice cream | 500★ | $5.00 |
| Netflix month | 1000★ | $10.00 |
| Amazon gift card | 1000★ | $10.00 |
| Date night | 2000★ | $20.00 |

## Star ledger

`StarLedgerEvent` is append-only. `Player.points` is a cached **current unspent** balance (includes amounts still held for pending requests).

Wallet:

```
availableStars = max(0, currentStars − pending holds)
lifetimeEarned = EARN_HARVEST + EARN_GRANT + OPENING_BALANCE
currentStars   = max(0, lifetimeEarned + ADJUST_ADMIN − SPEND_REWARD)
```

`HOLD_REWARD` / `RELEASE_REWARD` lines are audit only. Live `heldStars` come from `PENDING` rows.

| Event | Stars | Reward status |
| --- | --- | --- |
| **Request** | Reject if `availableStars < price`. `HOLD`. Do **not** decrement `points`. | `PENDING` |
| **Deny** | `RELEASE`. `points` unchanged. Hold cleared. | `DENIED` |
| **Approve** (`/fulfill` alias) | `SPEND`. `points = max(0, points − starsHeld)`. | `OWNED` |
| **Mark redeemed** | No star change. | `REDEEMED` |

Lifetime earned does **not** drop on hold, spend, or redeem. Admin SET writes `ADJUST_ADMIN` (signed) and is **not** earned. `POST /api/admin/players/:id/grant-stars` writes `EARN_GRANT`.

Shared helpers: `availableStars`, `canAfford`, `spendHeldStars`, `walletFromLedger` in `packages/shared/src/store.ts`.

## Reward lifecycle

Statuses: **PENDING → OWNED → REDEEMED**, plus **DENIED** (historical, not a happy-path phase). Rows are never deleted. Title / emoji / description / starCost are snapshotted at request time.

Existing `FULFILLED` rows migrated to **OWNED** (prior “fulfill” meant parent approval, not verified use).

## Surfaces

| Who | Where | What |
| --- | --- | --- |
| Kid | Farm dashboard → Farm Store | **Browse catalog without PIN** (no silent Willow default). Spending / Waiting / Owned need identity. |
| Kid | Farm dashboard → Job Board corkboard | Family Wanted posters + coach; claim identity at claim time. See [`phase-2-job-board-farm.md`](phase-2-job-board-farm.md). |
| Kid | Garden → name / **Profile** | Wallet, pouch, selfies, Pending / Owned / Redeemed, accolades. See [`phase-2-kid-profile.md`](phase-2-kid-profile.md). |
| Parent | `/parent/store` | Pending **Approve \| Deny**, Owned **Mark redeemed**, catalog CRUD, kid wallets |
| Parent | `/parent/` inbox | Pending store rows **Approve \| Deny** |
| Parent | `/parent/kids` | Read-only wallet + reward lists next to chore graphs |
| Push | Parent SW | `store_redemption` shows **Approve \| Deny** → `POST /api/parent/redemptions/:id/approve\|deny` (`fulfill` still aliases approve) |

Notification `url` is `/parent/store`. Tag is `approval:store_redemption:<id>`.

## Identity (browse vs spend)

Opening Farm Store from the main farm **does not** require a PIN and **must not** silently shop as Willow (or any kid) just because a garden cookie exists.

- **Anonymous browse:** catalog + star prices. Wallet copy is generic (“Pick whose stars”). Personal available stars and `affordable` flags stay hidden until identified.
- **Spending / requesting** uses the active PIN garden session if there is one, otherwise **Whose stars?** + PIN (`enter`). Holds land on **that** kid’s ledger.
- **Waiting** and **Owned** are personal: same identity gate before those tabs load.

Shared picker: `WhoseKidPicker` (same enter/PIN path as chores). `GET /api/store` and `POST /api/store/request` still `requirePlayer` (401 without a session).

## API

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/store/catalog` | Anyone — active catalog + prices; **no** wallet / `affordable` |
| GET | `/api/store` | Player — catalog, wallet, pending, owned |
| POST | `/api/store/request` | Player — `{ skuId }`; holds stars |
| GET | `/api/profile` | Player — full kid overview |
| GET | `/api/parent/store` | Parent — pending, owned, history, skus, kids+wallets |
| POST | `/api/parent/store/skus` | Parent — create |
| PATCH | `/api/parent/store/skus/:id` | Parent — title / emoji / description / starCost / isActive / sortOrder |
| POST | `/api/parent/redemptions/:id/approve` | Parent session or action token — spend hold → owned |
| POST | `/api/parent/redemptions/:id/fulfill` | Alias of approve |
| POST | `/api/parent/redemptions/:id/deny` | Release hold |
| POST | `/api/parent/redemptions/:id/redeem` | Parent session — owned → redeemed |
| POST | `/api/admin/players/:id/grant-stars` | Admin — `{ amount, reason }` gameplay-earned grant |
| POST | `/api/admin/players/:id/resources` | Admin SET; star delta is `ADJUST_ADMIN` |

Approve / deny / redeem are atomic. A second parent gets “A grown-up already handled that one.” / “already marked that one used.”

## Backfill

On API boot, `backfillStarLedgers()` runs for players with **no** ledger rows yet:

1. Reconstruct `EARN_HARVEST` from `activityLog` harvest `details.points` (`earn:harvest:{log.id}`).
2. Replay store rows: PENDING → HOLD; DENIED → HOLD+RELEASE; OWNED/REDEEMED → SPEND (+ reward events).
3. Opening gap `points + spent − harvestTotal`: if positive, `OPENING_BALANCE` labeled legacy (unknown provenance, **not** a dated harvest); if negative, `ADJUST_ADMIN` reconcile.

New gardens write `OPENING_BALANCE` at create when starting stars &gt; 0.

## Verify

Demo PINs: Willow `1111` / Finn `2222` / Sage `3333`. Parent: `admin` / `farmhand-dev`.

```bash
docker compose up -d --build
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs   # if HTTP_PORT=8080
```

Smoke covers anonymous catalog vs 401 store/request, ice cream hold / deny / approve→owned, SET not counting as earned, grant 2100 → Date night → earn 100 → Movie night → redeem both, and `GET /api/profile`.

Manual: Farm Store buy; Parent **Approve** then **Mark redeemed**; garden **Profile** as Willow — lifetime vs available, owned vs redeemed, badges, pouch matching the HUD.

Out of this slice: Farmstead SKUs, Amazon/Netflix APIs, Playfield Art.
