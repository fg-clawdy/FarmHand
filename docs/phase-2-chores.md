# Phase 2 — Chores + purgatory (implemented)

Product source of truth: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Phase 2 — Chores.

This slice is **shipped** on the compose stack. Daily [selfie earn](phase-2-selfie.md) stays separate and must still work. Store catalog, Web Push, face-ID, effort banding, and Final Boss are still out of scope.

## What shipped

1. **21-task catalog** seeded on API boot (upsert by slug). `Set Out School Clothes` is inactive. `isGlobal` → assignment mode **ALL**; otherwise **RACE**. Deferred `estimatedMinutes` / `legacyPoints` are stored and unused.
2. **Claim = 1 provisional seed** into an **empty** plot. No empty plot → reject. No pouch seed spend. No stars.
3. **Purgatory:** plant appears immediately, greyed, no water / fert / harvest, maturity clock off (`planted_at` is null until approve).
4. **Approve** (Parent PWA `/parent`) starts growth. Then selfie watering rules apply like any confirmed plant.
5. **Deny** wilts. Kid **prunes** → empty plot. **No seed return.** Race / NONE period slots are released on deny so someone can try again.
6. **Brush Your Hair** is a normal chore with `requiresSelfie` + `requiresApproval` (photo for the parent queue). It does **not** unlock watering or grant the daily selfie seed.
7. **CRITICAL** dog chores (Feed Dog A.M./P.M., Walk the Dog) sort first in the parent inbox.

Parent login is the **same account** as Admin (`/api/admin/login`, cookie `fh_admin`). This slice does not add a second password. Web Push is not wired yet — the in-app inbox is the Approve | Deny path.

## Verify

Demo PINs: Willow `1111` / Finn `2222` / Sage `3333`. Parent/admin: `admin` / `farmhand-dev`.

```bash
docker compose up -d --build
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs   # if HTTP_PORT=8080
```

Manual:

1. Kid garden → **Chores** → claim (pick empty mound + crop). Grey **WAITING** plant appears.
2. Open [http://localhost/parent/](http://localhost/parent/) (or `$HTTP_PORT`) → Approve or Deny.
3. Approve: plant turns normal and the countdown starts. Water still needs today’s selfie.
4. Deny: plant **WILTED** → tap to prune → empty, pouch seeds unchanged.
5. Fill all 9 plots and claim again — rejected.
6. Two kids racing Feed Dog the same Chicago day — only one claim sticks.

## Implementation notes

- Periods use the game timezone (`America/Chicago`). `NONE` uses `periodKey = "open"` until deny or harvest.
- Claims run in a **serializable** transaction; race chores also insert `ChoreRaceSlot` (`choreId, periodKey`) so two kids cannot double-claim.
- Proof JPEGs for selfie-required chores land under `SELFIE_DROP_DIR/chores/`. They do not call `POST /api/selfie`.
