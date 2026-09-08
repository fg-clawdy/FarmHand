# Phase 1 — Definition of Done

Non-visual closeout for the monorepo player + admin + compose stack. Playfield Art owns crop/zoom seating; those items do **not** block this checklist.

## In scope for P1

### Player

- Shared farm plus **3 gardens**, **9 plots** each
- Plant, water, fertilize, harvest
- Tool glow; water/fertilizer counts on the tool buttons
- Ready plot = one-tap harvest with celebration plus visible **+stars / +seeds** (HUD deltas from `reward.points` and `reward.seedsReturned`)
- Growing sheet shows **crop + time remaining** (no plot number)
- PIN demo kids: Willow `1111`, Finn `2222`, Sage `3333`
- Ambient cow / exhaust / plaques

### Admin (`/admin`)

- Overview charts
- Players: CRUD, deactivate, PIN, resources
- Tunables
- Balance goals + snapshot
- Activity
- Login: `admin` / `farmhand-dev`

### Infra

- `docker compose up --build` with nginx in front of player, admin, and API
- `scripts/smoke.mjs` passes (see [How to run smoke](#how-to-run-smoke))

## Owned elsewhere / not blocking P1 code

Playfield Art owns garden zoom centering at **0.85**, strawberry left clip, and farm mound seating polish. Do not treat those as P1 code blockers.

## Manual tablet checks (clawdy)

- [ ] PWA install / hard-reload after pull
- [ ] Full plant → water/fert → harvest loop per demo kid (Willow, Finn, Sage)
- [ ] Admin opens at `/admin`

## Out of scope (later phases)

- Selfie / chore earn
- Real-world store
- Accolades
- Farmstead

## How to run smoke

Against a running Compose stack (nginx). Default host port is `80`; this repo’s `.env.example` / local `.env` may set `HTTP_PORT=8080`.

```bash
# default Compose mapping
BASE_URL=http://localhost node scripts/smoke.mjs

# when HTTP_PORT=8080
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs
```

The script keeps the existing plant / harvest / admin loop and asserts:

- 9 garden plots
- harvest `reward.points` and `reward.seedsReturned` (HUD deltas)
- `GET /api/admin/stats` series rows plus crop-mix fields
- `GET /api/admin/balance-goals` returns a non-empty goals string (seeded north star is OK)
- `GET /api/admin/balance-snapshot` returns knobs plus 7d/30d mix/economy windows

It temporarily speeds up tier 1 and watering, then restores defaults with `POST /api/admin/config/reset`.
