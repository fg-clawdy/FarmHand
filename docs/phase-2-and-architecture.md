# FarmHand product and architecture

Durable spec for app surfaces, economy, and Phase 2+. **Documentation only** — this file does not implement features.

Phase 1 closeout (what is already playable): [`docs/phase-1-done.md`](phase-1-done.md).

Items marked **LOCKED** are product decisions. Do not reopen them in implementation PRs without an explicit spec change.

---

## Three app surfaces (LOCKED)

FarmHand is three products behind one compose/nginx stack. Do not collapse Parent and Admin into one UI.

| Surface | Route | Audience | Job |
| --- | --- | --- | --- |
| **Admin** | `/admin` | Tech-OK parent / operator | Gameplay control |
| **Parent PWA** | `/parent` (new) | Non-tech parents | Chores, store, approvals, family graphs |
| **Player** | `/` | Kids on the shared tablet | Gameplay only |

### 1. Admin (`/admin`)

Gameplay ledger. Keep it operator-shaped.

- Overview KPIs and charts
- Players CRUD / deactivate / PIN / resources
- Tunables
- Balance goals and snapshot
- Activity / audit
- Login is shared with Parent (see [Auth](#auth-locked)); landing is role-aware

This surface already exists and is **tech-OK**. Do not move chore CRUD, store fulfillment, or Approve/Deny queues here as the primary parent workflow.

### 2. Parent PWA (`/parent`, new)

Non-tech daily driver. Installable PWA.

- Chore definition and assignment
- Store catalog and reward CRUD
- Approve / deny queues (chore claims, store redemptions)
- Accomplishment graphs from the **chore** perspective (who claimed, who was approved, streaks) — not the Admin harvest KPI charts
- Web Push with actionable **Approve | Deny** (see [Parent PWA notifications](#parent-pwa-notifications-required))

Parents should not need `/admin` for the school-night loop.

### 3. Player (`/`)

Kids’ tablet only: farm, gardens, plant / water / fert / harvest, PIN, celebration, ambient playfield.

No parent settings, no chore admin, no store fulfillment UI beyond the kid **requesting** a reward.

Playfield art (zoom seating, crop sheets, mounds) is owned by **Playfield Art**, not by this spec.

---

## Auth (LOCKED)

- **Shared accounts** across Admin and Parent PWA. One username/password (or later passkey) is a person, not a tenant.
- **Role-aware landing:** after login, a parent lands on Parent home (`/parent`) unless they opened `/admin` and are permitted.
- The **same login can open Admin** when that account is permitted (operator / tech-OK role). Permission is on the account, not a second password.
- No Family tenant layer. One self-hosted farm. Timezone is the game timezone (`America/Chicago` today).
- Kids stay on PIN sessions at `/`. Kid PINs are not parent logins.

---

## Phase 1 context

P1 is **done as a playable loop + admin ledger**. See [`docs/phase-1-done.md`](phase-1-done.md).

In scope there: farm + 3 gardens, 9 plots, plant/water/fert/harvest, tool glow, one-tap harvest with +stars/+seeds, growing sheet (crop + time), demo PINs, ambient farm, Admin charts/players/tunables/balance/activity, compose + nginx, `scripts/smoke.mjs`.

**Not blocking P1 code:** Playfield Art (garden zoom at 0.85, strawberry clip, farm mound seating).

**Not in P1** (this document): selfie/chore earn, Parent PWA, real-world store, accolades, farmstead.

---

## Economy (LOCKED)

Currency for the real-world store is **stars**.

| Rule | Value |
| --- | --- |
| Peg | **1★ = 1¢ USD** |
| Soft target | ~**500★ / $5** per week, ~**2000★ / $20** per month |
| Hard cap | ~**750★ / $7.50** per week, ~**3000★ / $30** per month |

### How stars are earned

- Stars come **only** from **harvesting a confirmed plant**.
- A chore claim does **not** grant stars. A selfie does **not** grant stars.
- Denied / wilted / pruned chore plants grant **nothing**.

### Crops (current flatten)

Aesthetic choice only — same numbers on every crop until a later balance pass:

- **seedCost = 1**
- **durationMinutes = 24 × 60** (24 hours)
- **points = 25★** on harvest
- **harvestSeedReturn = +1 seed** (plant 1, harvest +1 → seed-neutral)

Kids pick corn / strawberry / cotton by look, not by a ladder.

### Starter store (parent fulfill, not auto-buy)

Mid–Phase 2 catalog. The kid **requests**; a parent **fulfills or denies** in the Parent PWA. Nothing auto-ships.

| Reward | Stars | USD at peg |
| --- | --- | --- |
| Movie night | 200★ | $2.00 |
| Ice cream | 500★ | $5.00 |
| Netflix month | 1000★ | $10.00 |
| Amazon gift card | 1000★ | $10.00 |
| Date night | 2000★ | $20.00 |

Expand later with farmstead (Phase 4). Do not add selfie/chore/store SKUs in P1.

### Balance bot

A weekly and monthly review (human-in-the-loop or scripted against Admin snapshot + goals) tunes:

- harvest ★ per crop (and later per-tier if the flatten is lifted)
- chore → seed **volume** (how many **1-seed** provisional plants chores inject — assignment density / which chores are on, **not** seeds-per-claim)

…so actual payout stays near the soft targets and under the hard caps. Admin **Balance goals / snapshot** is the read model; tunables are the write model.

---

## Phase 2 — Selfie earn (LOCKED)

Kids earn a **daily watering unlock** plus **+1 seed** by taking a live selfie. This is not a star grant, **not a chore**, and **not** a “Final Boss” catalog row. Do not ship a Selfie Final Boss task.

### Capture

- **Live front-camera** capture on the tablet (no library roll picker as the v1 path).
- Write the frame into an **Immich-watched local folder**. After the file is on disk, **Immich itself is out of scope** — FarmHand does not operate Immich, albums, or sharing.
- **Quality gate:** face roughly centered in frame; reject empty, too-dark, too-blurry, or no-face shots. Fail closed with a kid-readable retry.

### Attribution v1

- Credit the kid whose **garden / PIN session is active**.
- **No parent approve** on selfie. It is not a chore claim.
- Nice-to-have later (not v1):
  - enrolled **face-ID**
  - a multi-kid selfie credits **all recognized enrolled** kids

### Reward

On a accepted capture, for that kid, for the rest of the **America/Chicago** day:

1. **Unlock watering**
2. **+1 seed**

A second selfie the same Chicago day does not stack extra seeds or extend past midnight Chicago.

### Watering once unlocked

P2 watering model (replaces “watering is always free at garden-level caps”):

- Watering is available only after that day’s selfie unlock (for that kid).
- **Per plant:** at most one water every **4 hours**, and at most **3 waters per Chicago day**.
- Caps are **per plant**, not shared across the garden. Every growing plant may be watered under those caps.
- Unlocked watering is still free (no seed cost). Fertilizer stays a separate pouch item.
- Implementation uses existing tunables `wateringCooldownMinutes` (default 240) and `wateringMaxPerDay` (default 3) **per plant**, gated on `selfieUnlockDate` for the Chicago day. See [`phase-2-selfie.md`](phase-2-selfie.md).

---

## Phase 2 — Chores (LOCKED direction)

Adapt a claim → approval chore system (assignment modes **all / specific / race**, period math, **serializable claims**) onto Player + Parent/Admin.

Constraints vs a generic family-chore app:

- **No Family tenant.** One farm. Periods and “today” use the **game timezone**.
- The longer Task/Chore re-implementation guide still informs **concurrency, assignment modes, and period math** (who may claim, racing a shared chore, claiming once per period, serializable writes so two kids cannot double-claim). FarmHand v1 does **not** copy that guide’s payout model. Gratification is the **purgatory plant** below.

### Claim → purgatory plant

**LOCKED for v1:** every chore claim plants exactly **1** provisional seed. No multi-seed claims. Do not band by `legacyPoints` or `estimatedMinutes` in Phase 2.

1. Kid taps claim on an eligible chore (assignment + period rules pass).
2. The server **immediately plants exactly 1 provisional seed** into an **empty** plot in that kid’s garden (kid picks crop, or a default crop if the plot picker is skipped — implementation detail; the plant is still provisional).
3. If there is **no empty plot**, the claim is rejected. Do not queue a plant in the abstract.

### Purgatory

While pending parent review the plant:

- **Occupies the plot**
- Renders **greyed out** (not a normal growing crop)
- **Cannot** be watered, fertilized, or harvested
- Does not tick toward READY / stars

Parent approval happens on the **Parent PWA**. The kid’s claim click is **not** blocked waiting for a parent. The plant sits in purgatory until a parent acts.

### Approve

Provisional plant becomes a **normal plant** at the moment of approval (`planted_at` / maturity clock starts on approve, not on claim). After that it can grow, be watered (if watering is unlocked), fertilized, and harvested for stars.

### Deny

Plant **wilts** → kid **prunes** → plot **empty**. **No seed return.** No stars.

### Stars

Stars never come from the chore claim. Stars come only from **harvest after the plant was confirmed**.

### Seed chore catalog

Default **21-task** seed set for Phase 2 (Selfie 🏰 Final Boss is **not** in gameplay and is **not** seeded). Seeded on API boot; see [`phase-2-chores.md`](phase-2-chores.md). Omit legacy IDs and `nextDue` dates.

v1 seed mapping: `isGlobal` → assignment mode **ALL** (each kid may claim once per period); otherwise **RACE** (one farm-wide claim per period). SPECIFIC assignments exist on the model for later parent CRUD.

Parent PWA v1 may show the **emoji**. Later, pair light/dark PNGs as:

`apps/parent/public/icons/chores/<slug>-light.png`  
`apps/parent/public/icons/chores/<slug>-dark.png`

#### FarmHand mapping

- **All chores = 1 seed (LOCKED for v1).** Every claim plants exactly **1** provisional seed into purgatory. No banding, no multi-seed claims in Phase 2.
- `estimatedMinutes` and `legacyPoints` (historically **5–100**; **100** recorded for sweep/mop) are **deferred metadata** only. They do **not** change the seed grant. Effort banding / “harder chores plant more seeds” is a **later-phase** decision — do not invent that system in P2.
- **Stars still only from harvest** (flat **25★**). Chore points are not stars.
- Daily [selfie earn](#phase-2--selfie-earn-locked) is its own flow (water unlock + +1 seed). It is **unrelated** to the chore catalog. Do not add a Final Boss chore to represent it.
- **Brush Your Hair** `requiresSelfie` **and** `requiresApproval`. That is a normal chore claim that needs a photo for the parent queue — not the daily selfie earn.
- **Set Out School Clothes** is seeded **`isActive` false** (off). Keep the row so it can be turned on later.
- **CRITICAL** for Parent PWA emphasis (pin, color, or top of inbox): **Feed Dog A.M.**, **Feed Dog P.M.**, **Walk the Dog**.

Walk the Dog and Easy Bedtime had descriptions in the source catalog; copy was not transferred. Restore from the Task/Chore guide when seeding. Other rows have no description. Two rows have no `estimatedMinutes` in the source list (`—`).

Flag shorthand in the table: **Y** = true, blank = false.

| # | Title | Emoji | Recurrence | timeOfDay | Priority | Min | Approve | Selfie | Skip | Global | Path | Active | Legacy pts |
| -: | --- | --- | --- | --- | --- | -: | :---: | :---: | :---: | :---: | :---: | :---: | ---: |
| 1 | Make your bed | 🛏️ | DAILY | MORNING | NORMAL | 2 | Y | | | Y | Y | Y | — |
| 2 | Clean your room | 🪟 | WEEKLY | ANYTIME | NORMAL | 5 | Y | | | Y | | Y | — |
| 3 | Brush Teeth A.M. | 🌅 | DAILY | MORNING | NORMAL | 5 | Y | | | Y | Y | Y | — |
| 4 | Brush Teeth Bedtime | 🌙 | DAILY | ANYTIME | NORMAL | 5 | Y | | | Y | Y | Y | — |
| 5 | Dishes (1/6) | 🍽️ | DAILY | ANYTIME | NORMAL | 5 | Y | | Y | | Y | Y | — |
| 6 | **Feed Dog A.M.** | 🌅 | DAILY | MORNING | **CRITICAL** | 5 | Y | | | | Y | Y | — |
| 7 | **Feed Dog P.M.** | 🌙 | DAILY | EVENING | **CRITICAL** | 5 | Y | | | | Y | Y | — |
| 8 | **Walk the Dog** | 🚶 | DAILY | AFTERNOON | **CRITICAL** | 15 | Y | | | | Y | Y | — |
| 9 | Take Out Trash | 🗑️ | DAILY | ANYTIME | NORMAL | — | Y | | | | | Y | — |
| 10 | Put Up Clean Laundry | 👕 | WEEKLY | ANYTIME | HIGH | 10 | Y | | | Y | | Y | — |
| 11 | Brush Your Hair | 🌅 | DAILY | ANYTIME | NORMAL | 5 | Y | Y | | | Y | Y | — |
| 12 | Set Out School Clothes | 👕 | WEEKDAYS | ANYTIME | NORMAL | — | Y | | | Y | | | — |
| 13 | Easy Bedtime | 🌙 | DAILY | EVENING | LOW | 15 | Y | | | Y | Y | Y | — |
| 14 | Clean Living Room | 🧹 | NONE | AFTERNOON | HIGH | 10 | Y | | | | | Y | — |
| 15 | Clean Dining Room | 🧹 | NONE | AFTERNOON | HIGH | 5 | Y | | | | | Y | — |
| 16 | Clean Shoe Room | 👟 | DAILY | AFTERNOON | NORMAL | 5 | Y | | Y | | Y | Y | — |
| 17 | Clean Formal Living | 🧹 | NONE | AFTERNOON | HIGH | 10 | Y | | | | | Y | — |
| 18 | Clean Formal Dining | 🍽️ | NONE | AFTERNOON | HIGH | 5 | Y | | | | | Y | — |
| 19 | Clean Table | 🧽 | DAILY | ANYTIME | NORMAL | 5 | Y | | Y | | Y | Y | — |
| 20 | Sweep and Vacuum downstairs | 🧹 | NONE | ANYTIME | NORMAL | 30 | Y | | | | | Y | 100 |
| 21 | Mop the downstairs | 🧹 | NONE | ANYTIME | NORMAL | 30 | Y | | | | | Y | 100 |

Field names for implementers: `title`, emoji / icon hint, `description` (if any), `recurrence`, `timeOfDay`, `priority`, `estimatedMinutes`, `requiresApproval`, `requiresSelfie`, `allowsSkip`, `isGlobal`, `includeInPath`, `isActive`, plus deferred `legacyPoints` (not a live payout; not `isBonusSelfie` — that flag died with Final Boss).

Suggested slugs for future icon PNGs: `make-your-bed`, `clean-your-room`, `brush-teeth-am`, `brush-teeth-bedtime`, `dishes-1-6`, `feed-dog-am`, `feed-dog-pm`, `walk-the-dog`, `take-out-trash`, `put-up-clean-laundry`, `brush-your-hair`, `set-out-school-clothes`, `easy-bedtime`, `clean-living-room`, `clean-dining-room`, `clean-shoe-room`, `clean-formal-living`, `clean-formal-dining`, `clean-table`, `sweep-and-vacuum-downstairs`, `mop-the-downstairs`.

`NONE` recurrence = unscheduled / as-assigned (period math still applies when a parent puts it on a path). `WEEKDAYS` = Chicago Mon–Fri. `Dishes (1/6)` is a **race / rotation** title hint, not a sixth surface.

---

## Phase 2 — Real store (LOCKED starter)

- Ship the **small catalog** in [Economy](#starter-store-parent-fulfill-not-auto-buy) mid-P2.
- Kid **requests** a reward from the player store building (today’s “Coming Soon”).
- Parent **fulfills or denies** in the Parent PWA (not auto-buy, not Admin-primary).
- Fulfillment is a real-world promise (movie night happens, ice cream is bought). The app records the decision and spends stars only on **fulfill** (or on request-hold — implementation may hold stars on request and release on deny; do not double-spend).
- Expand the catalog later with **farmstead** (Phase 4).

---

## Parent PWA notifications (REQUIRED)

This is a required Phase 2 capability, not a polish item.

- Parent PWA is **installable** (manifest + service worker).
- **Web Push** via **VAPID** + the service worker. HTTPS (or trusted local equivalent) is required for push.
- Notifications are **actionable:** **Approve | Deny** on
  - chore claims (purgatory plants)
  - store redemptions / fulfillment requests (as applicable)
- **Multi-parent:**
  - Approve/deny is **atomic** on the server (one winner; second actor sees already-resolved).
  - When one parent acts, **clear / dismiss stale notifications** on other parents’ devices for that same claim or redemption.
- **In-app inbox** is the fallback when push is denied, the device is asleep without SW, or the action payload is stale. Inbox rows resolve to the same atomic endpoints.

Do not implement push-only without the inbox. Do not leave a second parent’s notification looking live after the first parent resolved it.

---

## Later phases (brief)

### Phase 3 — Accolades

Seasonal badges at **10 / 50 / 100** of a tracked action, plus **lifetime legends**:

- First Harvest
- Homestead Helper (500 waters)
- Barn Full
- Early Bird (30 days)
- Camera Kid (50 selfie claims)

Display on the player farm; Admin/Parent can see the same ledger. No star payout from badges unless a later spec says so.

Implemented v1 catalog, season rule, hooks, and verify steps: [`docs/phase-3-accolades.md`](phase-3-accolades.md). Sibling Spark and County Fair Champ stay deferred.

### Later — chore effort banding (not P2)

`estimatedMinutes` / `legacyPoints` stay on the catalog as **deferred data**. Whether harder chores plant more seeds (or are “worth more”) is an explicit **later-phase** product decision. Do not invent banding, multi-seed claims, or a second selfie-as-chore in Phase 2.

### Phase 4 — Farmstead + dual currency

- **Stars** continue to buy the **real-world store**.
- A **digital / homestead** currency (name TBD) buys farmstead cosmetics and buildings.
- Do not spend stars on digital homestead SKUs.

---

## Build order suggestion

Reasonable sequencing after this document. Each step should stay shippable; do not start farmstead or accolades in P2.

1. **Shared auth + roles** — one account; Parent home vs Admin permission; role-aware landing.
2. **Parent PWA shell** — `/parent` route, installability, chore-perspective empty home, in-app inbox scaffold.
3. **Web Push** — VAPID keys, service worker, subscribe, actionable buttons, multi-parent dismiss. Inbox wired to the same mutations.
4. **Selfie earn** — live capture, quality gate, Immich-watched drop, session attribution, +1 seed and Chicago-day watering unlock. No parent queue.
5. **Per-plant watering caps** — 4h / 3-per-day per plant, gated on the unlock. Update tunables/smoke.
6. **Chore engine** — assignment modes (all / specific / race), period math, serializable claims. Seed the [21-task catalog](#seed-chore-catalog). Every claim = **1** purgatory seed. No Family tenant; game timezone. Daily selfie earn stays the [selfie section](#phase-2--selfie-earn-locked), not a catalog chore.
7. **Purgatory plants** — claim plants immediately (**1 seed**); greyed plot; approve → normal plant; deny → wilt/prune/empty, no seed return. Parent PWA Approve | Deny + push (CRITICAL dog chores first).
8. **Starter store** — five SKUs; kid request; parent fulfill/deny; star hold/spend; push as applicable.
9. **Balance bot loop** — weekly/monthly review against 500★ / 2000★ targets and hard caps; tune harvest ★ and chore-seed volume via existing Admin tunables + snapshot.

Nice-to-have after the above, still P2-adjacent: face-ID enrollment; multi-kid selfie credit.

**Out of this sequence:** Playfield Art polish, Phase 3 accolades, Phase 4 farmstead.
