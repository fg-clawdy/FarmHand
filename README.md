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

- `apps/player` — touch-first PWA
- `apps/admin` — parent ledger at `/admin`
- `apps/api` — server-authoritative game rules
- `packages/shared` — types, default tunables, maturity math
- `nginx/` — reverse proxy
- `docker-compose.yml` — one-command deploy

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

1. Open the farm dashboard. Each kid has a wooden name sign, mascot, live seeds/stars, and a lock if a PIN is set.
2. Tap a garden. Enter the 4-digit PIN. A successful PIN starts a **30-minute server session**; coming back during that window skips the pad.
3. Plant on an empty plot. Unaffordable tiers are disabled.
4. Water (free, 4h cooldown, max 3/day) or fertilize while a plant is growing. Countdown and READY state come from the server.
5. Harvest when the plot glows gold. The kid earns the tier’s stars and **1 seed is returned**.
6. Open the ingredient shed (🧪+) to claim the daily ingredient (Moon Dew → Grow Goo → Phoenix Ash) and mix 1 of each into fertilizer.
7. The Farm Store building is **Coming Soon** only.

Starting pouch: **10 seeds, 0 stars**.

Default tiers:

| Tier | Plant | Seeds | Time | Stars | Fertilizer shave |
| --- | --- | --- | --- | --- | --- |
| 1 🌼 | Prairie Daisy | 1 | 24h | 1 | 4h |
| 2 🌿 | Kitchen Herbs | 2 | 48h | 2 | 6h |
| 3 🌻 | Sunflower | 3 | 72h | 4 | 8h |
| 4 🌳 | Homestead Oak | 4 | 96h | 8 | 10h |

Watering knocks **60 minutes** off remaining time.

To try a harvest without waiting a day, sign in to `/admin`, open **Tunables**, set tier 1 duration to `1` (minute) or `0`, save, then plant as a kid.

## Parent admin

At `/admin` you can:

- See the farm pulse (active sessions, harvests today, waterings today, READY plants)
- List kids and open a read-only 6-plot garden
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

## Tests

```bash
npm test
```

Shared package tests cover maturity math and growth stages. API tests cover daily watering reset and cooldown.
