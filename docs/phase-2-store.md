# Phase 2 — Real-world stars store (starter)

Product source of truth: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Economy (LOCKED) starter store + § Phase 2 — Real store.

This slice replaces the player Farm Store “Coming Soon” stub and the Parent Store nav stub. Kids **request** real-world rewards with **stars**. A parent **fulfills or denies** in the Parent PWA. Nothing auto-buys Amazon/Netflix. Farmstead / digital SKUs stay out of scope.

Push helpers already existed; this slice **wires** them. Same Approve/Deny (here Fulfill/Deny) + clear-across-parents pattern as chores: [`phase-2-parent-push.md`](phase-2-parent-push.md).

## Product locks

- Currency is **stars only**. **1★ = 1¢**. Stars are still earned **only from harvest**.
- Kid requests from the **player Farm Store** building.
- Parent fulfill is a **real-world promise** (ice cream is bought, movie night happens). Primary UI is **Parent PWA**, not Admin.
- No auto-purchase integrations.

Starter catalog (seeded create-if-missing, like chores — parent edits persist across API restarts):

| Reward | Stars | USD at peg |
| --- | --- | --- |
| Movie night | 200★ | $2.00 |
| Ice cream | 500★ | $5.00 |
| Netflix month | 1000★ | $10.00 |
| Amazon gift card | 1000★ | $10.00 |
| Date night | 2000★ | $20.00 |

## Hold / spend / release

`Player.points` is earned-unspent until **fulfill**. Pending rows snapshot `title`, `emoji`, and `starCost` at request time and hold that amount in `starsHeld`.

```
availableStars = max(0, points − sum(pending.starsHeld))
```

| Event | Stars |
| --- | --- |
| **Request** | Reject if `availableStars < price`. Create `PENDING` with `starsHeld = starCost`. Do **not** decrement `points`. |
| **Fulfill** | `points = max(0, points − starsHeld)`. Status `FULFILLED`. Hold is spent (not released). |
| **Deny** | Status `DENIED`. `starsHeld` cleared to 0. `points` unchanged. |

A second request that would overdraw available stars fails. Price edits on a SKU do **not** change in-flight holds. Deactivate a SKU to hide it; there is no delete (history stays).

Shared helpers: `availableStars`, `canAfford`, `spendHeldStars` in `packages/shared/src/store.ts`.

## Surfaces

| Who | Where | What |
| --- | --- | --- |
| Kid | Farm dashboard → Farm Store | Catalog cards, star balance + affordability, confirm (“hold N★ until a grown-up fulfills or denies”), pending (“waiting on a grown-up”), recent yes/no |
| Parent | `/parent/store` | Pending **Fulfill \| Deny** queue + catalog add/edit/on-shelf/star cost |
| Parent | `/parent/` inbox | Same pending store rows so push fallback works if they open Inbox instead of Store |
| Push | Parent SW | `store_redemption` shows **Fulfill \| Deny** → `POST /api/parent/redemptions/:id/fulfill\|deny` with the same Bearer action token as chores |

Notification `url` is `/parent/store`. Tag is `approval:store_redemption:<id>` so a later `clear` payload dismisses the live actions on other parent devices.

## API

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/store` | Player session — active catalog, ledger, own pending + recent |
| POST | `/api/store/request` | Player — `{ skuId }`; holds stars; `notifyStoreRedemptionPending` |
| GET | `/api/parent/store` | Parent — pending redemptions + all SKUs |
| POST | `/api/parent/store/skus` | Parent — create |
| PATCH | `/api/parent/store/skus/:id` | Parent — title / emoji / description / starCost / isActive / sortOrder |
| POST | `/api/parent/redemptions/:id/fulfill` | Parent session or action token — spend hold; `notifyStoreRedemptionResolved` |
| POST | `/api/parent/redemptions/:id/deny` | Parent session or action token — release hold; same clear push |
| GET | `/api/parent/inbox` | Also returns `redemptions` (pending) next to chore `claims` |

Fulfill/deny are atomic. A second parent gets “A grown-up already handled that one.”

## Verify

Demo PINs: Willow `1111` / Finn `2222` / Sage `3333`. Parent: `admin` / `farmhand-dev`.

```bash
docker compose up -d --build
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs   # if HTTP_PORT=8080
```

Smoke covers: SET Willow to 800★ → request Ice cream 500 → points stay 800, 500 held, 300 available → second Ice cream rejected → Deny releases → request again → Fulfill spends to 300★, never negative → parent catalog PATCH + create.

Manual:

1. Optional: `/admin` → Willow → set stars to at least 500 (or harvest enough 25★ plants).
2. Open [http://127.0.0.1:8080/](http://127.0.0.1:8080/) → tap **Farm Store**. Pick Willow / PIN `1111` if asked.
3. Ice cream should be affordable. Confirm. Balance shows **500★ waiting**. Catalog cards that cost more than remaining available are “Need more stars.”
4. Open [http://127.0.0.1:8080/parent/](http://127.0.0.1:8080/parent/) → sign in. **Inbox** and **Store** both list the request. **Deny** returns the hold; request again and **Fulfill** spends 500★.
5. On **Store**, edit a star cost or take a reward off the shelf. Kids see the new catalog; in-flight requests keep the old price.
6. If push is enabled, a request notifies **Fulfill \| Deny**. Acting on one device clears the other (same as chores).

Out of this slice: Farmstead SKUs, Amazon/Netflix APIs, accolades changes, Playfield Art.
