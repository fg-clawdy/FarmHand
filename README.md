# FarmHand

A family-friendly 1800s homestead game for three kids on one shared Samsung Galaxy tablet, plus a parent admin panel. Kids tend personal gardens on a shared farm. Parents tune the rules from `/admin`. Everything is self-hosted with Docker Compose and nginx.

Daily resets (watering caps and the ingredient claim) use **America/Chicago**.

## Architecture

```
Tablet / browser
        │
     nginx :80
        ├── /        → player PWA (Vite + React, landscape-first)
        ├── /admin   → parent SPA (Vite + React)
        └── /api     → Node.js API (Fastify + Prisma)
                         └── Postgres
```

Monorepo layout:

- `apps/player` — touch-first PWA (PixiJS farm/garden scene + React HUD/PIN/sheets)
- `apps/admin` — parent ledger at `/admin`
- `apps/api` — server-authoritative game rules
- `packages/shared` — types, default tunables, maturity math
- `assets/ATTRIBUTION.md` — Kenney/OGA inventory, licenses, and custom-art gaps
- `nginx/` — reverse proxy
- `docker-compose.yml` — one-command deploy

Locked product surfaces, economy, and Phase 2+ plans: [`docs/phase-2-and-architecture.md`](docs/phase-2-and-architecture.md). Phase 1 closeout: [`docs/phase-1-done.md`](docs/phase-1-done.md).

The API never trusts client timers. Maturity is `planted_at + tier duration − watering reductions − fertilizer reductions`. Plants do not wither.

Design numbers (session length, seed costs, grow times, water/fertilizer reductions, and so on) live in the `GameConfigRow` table. Change them in **Admin → Tunables** without rebuilding.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Open [http://localhost](http://localhost) (or `http://localhost:$HTTP_PORT` if you changed the port).

Health check: [http://localhost/api/health](http://localhost/api/health)

Stop with `docker compose down`. Data stays in the `farmhand_pg` volume. Add `-v` to wipe the database.

### Default dev logins

Created on first boot if the database is empty:

| Who | How to sign in |
| --- | --- |
| Parent admin | `/admin` · username `admin` · password `farmhand-dev` |
| Willow 🐄 | PIN `1111` |
| Finn 🐔 | PIN `2222` |
| Sage 🐷 | PIN `3333` |

Change `ADMIN_BOOTSTRAP_*` in `.env` **before** the first boot if you do not want the default admin password. Demo kid PINs can be rotated from the admin player detail page.

## How to play

1. Open the farm dashboard. The painted playfield shows three gardens with **live names** on the blank wooden signs (from `/api/farm`; change a name in Admin and it updates on the next poll). Tap a garden, or use the seed/point chips along the bottom.
2. Tap a garden. Enter the 4-digit PIN. A successful PIN starts a **30-minute server session**; coming back during that window skips the pad.
3. Plant on an empty plot. Unaffordable tiers are disabled.
4. Take **today’s selfie** (garden toolbar) to unlock watering and get +1 seed once per Chicago day. Then water (free, **per plant** 4h cooldown, max 3/day) or fertilize while a plant is growing. Countdown and READY state come from the server.
5. Harvest when the plot glows gold. The kid earns **25 stars** and **1 seed is returned** (plant cost is also 1, so a harvest is seed-neutral).
6. Open the ingredient shed (🧪+) to claim the daily ingredient (Moon Dew → Grow Goo → Phoenix Ash) and mix 1 of each into fertilizer.
7. The Farm Store building is **Coming Soon** only.

Starting pouch: **10 seeds, 0 stars**.

Default tiers (flat on purpose — crops differ by look, not by economy):

| Tier | Plant | Seeds | Time | Stars | Fertilizer shave |
| --- | --- | --- | --- | --- | --- |
| 1 🌽 | Sweet Corn | 1 | 24h | 25 | 4h |
| 2 🍓 | Strawberry | 1 | 24h | 25 | 6h |
| 3 ☁️ | Cotton | 1 | 24h | 25 | 8h |

Watering knocks **60 minutes** off remaining time.

To try a harvest without waiting a day, sign in to `/admin`, open **Tunables**, set any crop’s duration to `1` (minute) or `0`, save, then plant as a kid.

Existing Compose databases that still have the old 1/2/3-seed and 1/2/4★ ladder are flattened on the next API boot. To force the design table (and undo other tunable edits): **Admin → Tunables → Reset to defaults**, or `POST /api/admin/config/reset` as admin.

## Parent admin

At `/admin` you can:

- See the farm pulse (active sessions, harvests today, waterings today, READY plants)
- List kids and open a read-only 9-plot garden
- Create/edit a player (name, mascot, starting resources)
- Reset or clear a PIN (this also ends their session)
- Adjust resources with an audit reason
- Force-end a session
- Soft-deactivate a garden so it leaves the shared farm
- Edit every gameplay tunable, or reset them to design defaults
- Review 7-day login/water/harvest/star totals per kid, plus the admin audit log

## Tablet PWA tips (Galaxy Tab)

1. Open the farm in **Chrome**, rotate to **landscape**, and stay there — the layout is landscape-first.
2. Chrome menu → **Add to Home screen** / **Install app**. Launch from the home screen so it runs fullscreen.
3. In Chrome site settings, allow it to run without desktop mode.
4. Keep the tablet on the same network as the host (or set up your own HTTPS reverse proxy in front of this stack).
5. PINs are per kid; the 30-minute session is stored on the server and in a cookie on this tablet only.

Serving over HTTP on a home LAN is fine for a family tablet. If you terminate TLS elsewhere, set `COOKIE_SECURE=true`.

## Local development (without Docker for the frontends)

You still need Postgres. Easiest path is Compose for the database and API, Vite for UI:

```bash
cp .env.example .env
npm install
docker compose up postgres -d
# in another shell, from repo root:
export DATABASE_URL=postgres://farmhand:farmhand@localhost:5432/farmhand
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run dev:api
npm run dev:player   # http://localhost:5173
npm run dev:admin    # http://localhost:5174/admin/
```

## Environment

See `.env.example`. Compose variables:

- `HTTP_PORT` — host port mapped to nginx (default `80`)
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
- `ADMIN_BOOTSTRAP_USER` / `ADMIN_BOOTSTRAP_PASSWORD` — only used when no admin row exists
- `COOKIE_SECURE` — `true` when the app is behind HTTPS
- `SELFIE_DROP_DIR` — host folder Immich can watch; Compose bind-mounts it to `/data/selfies` in the API. See [`docs/phase-2-selfie.md`](docs/phase-2-selfie.md).

## Tests

```bash
npm test
```

Shared package tests cover maturity math and growth stages. API tests cover daily watering reset and cooldown.

Against a running stack (Compose maps nginx to `$HTTP_PORT`, default `80`):

```bash
BASE_URL=http://localhost node scripts/smoke.mjs
# or, if HTTP_PORT=8080:
BASE_URL=http://127.0.0.1:8080 node scripts/smoke.mjs
```

Phase 1 closeout checklist: [`docs/phase-1-done.md`](docs/phase-1-done.md).

Phase 2+ product / architecture spec: [`docs/phase-2-and-architecture.md`](docs/phase-2-and-architecture.md). Selfie earn implementation notes: [`docs/phase-2-selfie.md`](docs/phase-2-selfie.md).

