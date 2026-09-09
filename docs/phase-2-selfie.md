# Phase 2 — Selfie earn (implemented)

Product source of truth: [`phase-2-and-architecture.md`](phase-2-and-architecture.md) § Phase 2 — Selfie earn.

This slice is **shipped** on the compose stack. Chores, Parent PWA, store, face-ID, and Final Boss are still out of scope.

## What kids get

1. Live **front-camera** selfie from the garden toolbar (no photo library).
2. Quality gate on the tablet (FaceDetector when the browser has it; otherwise a centered-face / brightness heuristic). Fail closed with a retry message.
3. On accept, a JPEG lands in the **Immich-watched** folder. Immich itself is not started or configured here.
4. Once per **America/Chicago** day for that PIN session: watering unlock + **+1 seed**. No stars. No parent approve. A second selfie the same day does not stack.
5. Watering is **locked** until that day’s selfie. Then **per plant**: tunables `wateringCooldownMinutes` (default 240 = 4h) and `wateringMaxPerDay` (default 3).

## Configure the drop folder

Host path (bind-mounted into the API at `/data/selfies`):

```bash
# .env
SELFIE_DROP_DIR=./data/selfies
```

Point Immich’s watched folder at that same host path. The API writes `{chicago-day}_{name}_{id}_{time}.jpg`.

Camera capture needs a **secure context** (https or localhost). On a LAN tablet over plain http, Chrome will block `getUserMedia` — use https or Chrome’s insecure-origin exception.

## Manual check

1. `docker compose up -d --build api player nginx`
2. Sign in as Willow (`1111`).
3. Garden → **Selfie** → face in the oval → Take selfie.
4. Confirm +1 seed (first time today) and a new `.jpg` under `SELFIE_DROP_DIR`.
5. Water a growing plant; try the same plant again immediately (4h cooldown unless you set tunables to 0).
6. A second selfie the same day should not add another seed.

```bash
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs
```
