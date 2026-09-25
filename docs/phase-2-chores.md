# Phase 2 — Chores + purgatory (implemented)

Product source of truth: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Phase 2 — Chores.

This slice is **shipped** on the compose stack. Daily [selfie earn](phase-2-selfie.md) stays separate and must still work. Store catalog, face-ID, effort banding, and Final Boss are still out of scope. Parent Web Push: [`phase-2-parent-push.md`](phase-2-parent-push.md). Parent chore list + kid graphs: [`phase-2-parent-polish.md`](phase-2-parent-polish.md).

## What shipped

1. **21-task catalog** seeded on API boot (**create missing slugs only** — parent edits persist). `Set Out School Clothes` is inactive until a parent turns it on. `isGlobal` → assignment mode **ALL**; otherwise **RACE**. Deferred `estimatedMinutes` / `legacyPoints` are stored and unused.
2. **Claim = 1 provisional seed** into an **empty** plot. No empty plot → reject. No pouch seed spend. No stars.
3. **Purgatory:** plant appears immediately, greyed, no water / fert / harvest, maturity clock off (`planted_at` is null until approve).
4. **Approve** (Parent PWA `/parent`) starts growth. Then selfie watering rules apply like any confirmed plant.
5. **Deny** wilts. Kid **prunes** → empty plot. **No seed return.** Race / NONE period slots are released on deny so someone can try again.
6. **Brush Your Hair** is a normal chore with `requiresSelfie` + `requiresApproval` (photo for the parent queue). It does **not** unlock watering or grant the daily selfie seed.
7. **CRITICAL** dog chores (Feed Dog A.M./P.M., Walk the Dog) sort first in the parent inbox.

Parent login is the **same account** as Admin (`/api/admin/login`, cookie `fh_admin`). This slice does not add a second password. [Web Push](phase-2-parent-push.md) is optional on top of this inbox: same Approve | Deny endpoints, plus dismiss-across-devices when a claim is resolved.

## Kid Job Board (browse UI)

Kids browse chores on a full-screen **Job Board** (barn/corkboard, big emoji cards).

- **Main farm corkboard** (no PIN): Wanted posters rotate through chores still open for *someone* in the family. Tap → coach (“Do a job to plant a waiting seed”) → family board → **claim-time identity**. See [`phase-2-job-board-farm.md`](phase-2-job-board-farm.md).
- **Garden toolbar Chores** opens the same board for the kid already in a PIN garden session.

- Each open card shows the title, emoji, and a **+1 waiting seed** chip (not stars). Photo chores also say **Needs a photo**.
- **CRITICAL** dog chores (Feed Dog A.M./P.M., Walk the Dog) are pinned at the top.
- Tap a card → short confirm (empty plot + crop) → existing claim API. Photo chores still capture before claim.
- After a successful claim, the kid returns to the garden with a grey **WAITING** plant. Pouch seeds do not change.
- Ineligible / already-claimed jobs sit in a muted **Done for now** section with the short reason.
- If the garden has **no empty plots**, the board explains they need to harvest or prune before claiming.
- Assignment-aware: a SPECIFIC chore (e.g. Dishes for Willow+Finn) still appears on the **family** corkboard; claim only succeeds for assigned kids.

## Empty pouch seeds → Job Board

If the kid has **0 pouch seeds** (cannot afford the cheapest crop) and tries to plant from the seed tool or an empty plot, do **not** leave them stuck. Show the shared **Job Coach** modal (**Do a job to plant a waiting seed**) — the same path as tapping the farm corkboard — then the Job Board. Job Board claims still plant a provisional seed without spending pouch seeds.

## Verify

Demo PINs: Willow `1111` / Finn `2222` / Sage `3333`. Parent/admin: `admin` / `farmhand-dev`.

```bash
docker compose up -d --build
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs   # if HTTP_PORT=8080
```

Manual:

1. Kid garden → **Chores** → Job Board of big cards. Claim (pick empty mound + crop). Grey **WAITING** plant appears. Pouch seed count does **not** bump.
2. With **0 pouch seeds**, tap Seeds or an empty mound → nudge with **Do a job to plant a waiting seed** → Job Board. Claim still plants without spending pouch seeds.
3. Open [http://localhost/parent/](http://localhost/parent/) (or `$HTTP_PORT`) → Inbox Approve or Deny. **Chores** to edit the list, **Kids** for activity graphs. Optional: enable notifications (see [parent push](phase-2-parent-push.md)). Parent polish: [phase-2-parent-polish.md](phase-2-parent-polish.md).
4. Approve: plant turns normal and the countdown starts. Water still needs today’s selfie.
5. Deny: plant **WILTED** → tap to prune → empty, pouch seeds unchanged.
6. Fill all 9 plots and open the Job Board — it explains harvest/prune before claiming; claim is rejected.
7. Two kids racing Feed Dog the same Chicago day — only one claim sticks.

## Implementation notes

- Periods use the game timezone (`America/Chicago`). `NONE` uses `periodKey = "open"` until deny or harvest.
- Claims run in a **serializable** transaction; race chores also insert `ChoreRaceSlot` (`choreId, periodKey`) so two kids cannot double-claim.
- Proof JPEGs for selfie-required chores land under `SELFIE_DROP_DIR/chores/`. They do not call `POST /api/selfie`.
