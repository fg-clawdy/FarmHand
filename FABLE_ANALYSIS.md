# FarmHand — Security, Gameplay & Architecture Review

| | |
|---|---|
| **Repo** | `FarmHand` monorepo (`apps/api`, `apps/player`, `apps/parent`, `apps/admin`, `packages/shared`) |
| **Branch / commit** | `cursor/farmhand-monorepo-f3ca` @ `6e29d39` |
| **Review date** | 2026-09-11 |
| **Method** | Static read of the full API layer, shared package, infra config, player/parent/admin frontends; targeted greps; local test run. No production code was changed. |
| **Threat model** | Household deployment (Docker Compose behind nginx) that *may* be exposed to the internet. Actors: kids (player sessions, some without PIN), parents (admin sessions), anonymous network peers. Stars have real-money value (`1★ = 1¢`, `packages/shared/src/store.ts:10`). |

Line numbers reference the commit above. Secrets are not reproduced here beyond documented defaults.

---

## 1. Executive summary

FarmHand is well structured for its size: a single Fastify API, a shared rules package with good unit coverage (46/46 passing), an append-only star ledger with idempotency keys, Serializable transactions with retry for store and chore-claim flows, hashed session tokens, audit logs, and careful path-traversal guards on photo serving. The team clearly thought about the money-adjacent paths.

The most important gaps are:

1. **Economy actions that aren't money-adjacent by name still move money.** `harvest` (which mints stars), `water`, `plant`, `fertilize`, `ingredients/claim` and `ingredients/mix` run in default-isolation transactions with a read-then-write pattern and no row lock. Two concurrent taps double-harvest, double-water, or drive ingredient counts negative. Stars are cash-convertible, so this is the top finding.
2. **Authentication is brute-forceable.** The 4-digit player PIN and the admin password have no rate limiting, lockout, or backoff anywhere in the API. Player IDs are enumerable from the unauthenticated `/api/farm`. Bootstrap admin credentials default to `admin` / `farmhand-dev`, and Postgres defaults to `farmhand` / `farmhand`.
3. **Admin config is trusted verbatim.** `mergeGameConfig` spreads the incoming object over defaults with almost no validation. A typo (or a hostile parent) can set `plotCount` to 10⁶, `timezone` to garbage (500s on every request), or negative economy tunables.
4. **Uploads are unbounded per player.** Any player session (including PIN-less players, which anyone on the network can enter) may upload unlimited 6 MB JPEGs; there is no per-day cap and no retention, so disk exhaustion is trivial.
5. **Transport/edge hardening is left to the operator.** nginx listens on port 80 only, no security headers, `COOKIE_SECURE=false` by default, CORS reflects any origin with credentials.

**Finding counts:** High **4** · Medium **9** · Low **7** · Informational **4** — 24 total.

---

## 2. Findings

Severity scale: **High** = direct money/child-safety impact or full account takeover with low effort · **Medium** = integrity/availability impact or requires a precondition · **Low** = defense-in-depth / hygiene · **Info** = observation, no direct risk.

### High

#### F-001 · Double-harvest / double-water race (no lock on plot mutations)
- **Area:** Gameplay economy · `apps/api/src/routes/player.ts`
- **Where:** `harvest` 396–473, `water` 259–338, `plant` 196–257, `fertilize` 340–394, `ingredients/claim` 565–599, `ingredients/mix` 601–634
- **Evidence:** Every handler does `prisma.$transaction(async (tx) => { const player = await tx.player.findUniqueOrThrow(...include plots); const plot = player.plots.find(...); if (!ready) throw; await tx.player.update({ points: { increment: tier.points } }) ... })` with **no isolation level and no `FOR UPDATE`** (contrast `chores.ts:261` `SELECT id FROM "Plot" WHERE id = ${plot.id} FOR UPDATE` and `chores.ts:316` / `store.ts:267` `isolationLevel: Serializable`). Harvest at 420–431 increments points and seeds *before* clearing the plot at 428–431; a second concurrent request that read the same snapshot passes `serialized.ready` and increments again. `mix` 609–617 checks `< 1` then `decrement`, so concurrent calls drive `moonDew`/`growGoo`/`phoenixAsh` negative.
- **Impact:** A kid double-tapping (or a trivial script replaying the request) mints stars twice per harvest — stars are 1¢ each and redeemable for gift cards. Watering twice halves grow time. Ingredient counters can go negative and fertilizer can be minted without inputs.
- **Recommendation:** Reuse the pattern already in `chores.ts`: lock the plot row (`SELECT … FOR UPDATE`) or run these transactions Serializable with the existing retry helper; alternatively make the state transition conditional (`updateMany({ where: { id, plantedAt: plot.plantedAt, plantTier: plot.plantTier }, data: EMPTY })` and abort if `count === 0`). Add a DB `CHECK (moonDew >= 0)` constraint or conditional `updateMany` for ingredient decrements. Add an integration test that fires two harvests concurrently and asserts a single `EARN_HARVEST` line.

#### F-002 · 4-digit PIN with no brute-force protection; player IDs are public
- **Area:** AuthN · `apps/api/src/routes/player.ts`, `apps/api/src/routes/farm.ts`
- **Where:** `player.ts:56–102`; `farm.ts:9,32`
- **Evidence:** `POST /api/players/:id/enter` (56) checks `/^\d{4}$/.test(pin) && verifySecret(pin, player.pinHash)` (78–83) and returns 401 on failure. A repo-wide grep for `rate|limit|attempt|lockout` finds no rate limiter or attempt counter in the API (`app.ts:11` only sets `bodyLimit`). `GET /api/farm` (`farm.ts:9`) is unauthenticated and returns every player's `id`, `name`, `mascot` and `hasPin` (32).
- **Impact:** 10,000 guesses per player, unauthenticated, with IDs handed out for free. A sibling or anyone on the network can impersonate a child in minutes, harvest their crops, and spend their stars on store requests. Players with `hasPin: false` need no guess at all.
- **Recommendation:** Add `@fastify/rate-limit` keyed on `playerId + ip` for `/enter` (e.g., 5 attempts / 15 min, then exponential lockout persisted on the `Player` row). Log failed attempts to `ActivityLog`. Consider requiring PIN for all players when not on a private network, and stop exposing `hasPin` publicly.

#### F-003 · Default admin/DB credentials and un-throttled admin login
- **Area:** AuthN / Deployment · `apps/api/src/seed.ts`, `.env.example`, `docker-compose.yml`, `apps/api/src/routes/admin.ts`
- **Where:** `seed.ts:17–18, 28–36`; `.env.example:5–10`; `docker-compose.yml:5–7,22`; `admin.ts:35–49`
- **Evidence:** `const adminUser = process.env.ADMIN_BOOTSTRAP_USER || "admin"; const adminPass = process.env.ADMIN_BOOTSTRAP_PASSWORD || "farmhand-dev";` seeded when `admin.count() === 0`. Compose falls back to `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-farmhand}`. `/api/admin/login` (35) has no rate limit; sessions are a fixed 12 h (42, 46).
- **Impact:** Anyone who can reach port 80 and knows the project can log in as admin unless the operator changed the default, and the admin session is *also* the parent session (see F-010): full control over players, star grants (`admin.ts:324`), config, and children's photos (`parent.ts:277`).
- **Recommendation:** Refuse to seed when `ADMIN_BOOTSTRAP_PASSWORD` is unset or equals the documented default in `NODE_ENV=production`; force a password change on first login; rate-limit `/api/admin/login`; drop the Postgres default password from compose (require it in `.env`).

#### F-004 · Unbounded photo uploads per player → disk exhaustion
- **Area:** Availability / Child-data · `apps/api/src/routes/player.ts`, `apps/api/src/selfie.ts`
- **Where:** `player.ts:135–194` (`POST /api/selfie`), `player.ts:493–549` (`/chores/:id/claim`), `selfie.ts:4–5, 79–91, 94–104`
- **Evidence:** `/api/selfie` accepts up to `SELFIE_MAX_BYTES = 6 MiB` (`selfie.ts:4`), writes the file at 144–149 **before** the transaction, and only afterwards records `selfieUnlockDate`. There is no check that today's selfie already exists — `planSelfieReward` (155) merely decides whether to grant a seed; the write always happens. Filenames include an ISO timestamp (`selfie.ts:87–88`), so every call creates a new file. Nothing deletes old files (no `unlink`/`rm` anywhere in `selfie.ts`). Combined with F-002 (PIN-less players are enterable by anyone), this is reachable without credentials.
- **Impact:** A single loop fills the `SELFIE_DROP_DIR` volume (which is also Immich-watched per `.env.example:15`) and takes the API and Postgres host down. Photos of children accumulate indefinitely with no retention policy.
- **Recommendation:** Reject `/api/selfie` when `selfieUnlockDate === today` (return the existing state), or cap uploads per player per day; move the file write *inside*/after the transaction and delete on rollback; add a retention sweep (e.g., keep last N per player, matching `listPlayerSelfies(limit=12)`); apply a per-session rate limit on both upload routes.

### Medium


#### F-005 · `mergeGameConfig` trusts admin input almost verbatim
- **Area:** Config integrity · `packages/shared/src/config.ts`, `apps/api/src/routes/admin.ts`
- **Where:** `config.ts:112–166`; `admin.ts:395–404`
- **Evidence:** `return { ...DEFAULT_GAME_CONFIG, ...incoming, timezone: incoming.timezone || DEFAULT…, plotCount: Math.max(PLOTS_PER_GARDEN, Number(incoming.plotCount) || 0), … }` (153–165). Only `plotCount` (lower bound only), `jobBoardPosterDwellSeconds`, `balanceGoals`, `tiers`, `ingredients` get any shaping; `sessionMinutes`, `wateringMaxPerDay`, `wateringReductionMinutes`, `harvestSeedReturn`, `mixYield`, `startingPoints`, tier `points`/`seedCost`/`durationMinutes` accept any JSON value (strings, negatives, `NaN`, `null`). Unknown keys are persisted to `GameConfigRow`. `PUT /api/admin/config` calls `saveConfig(mergeGameConfig(body.config))` with no schema.
- **Impact:** `plotCount: 1000000` makes `syncPlayerPlots` create a million rows per player on next `/enter`. An invalid `timezone` string makes every `todayKey()` call throw → API-wide 500s until the DB row is fixed by hand. Negative `harvestSeedReturn` or `points` corrupt the economy; `sessionMinutes: 0` logs everyone out instantly.
- **Recommendation:** Validate with a schema (Fastify has native JSON-schema support; zod/typebox also fit) and clamp: `plotCount ∈ [9, 36]`, minutes/day counts ≥ 1, `timezone` verified via `Intl.supportedValuesOf('timeZone')` or a try/`DateTimeFormat`, tier numbers finite and ≥ 0. Strip unknown keys. Add tests in `config.test.ts` for each rejected shape.

#### F-006 · Two sources of truth for star balance (`Player.points` vs ledger) can diverge
- **Area:** Economy integrity · `apps/api/src/store.ts`, `apps/api/src/routes/admin.ts`, `packages/shared/src/store.ts`
- **Where:** `store.ts:281–291`; `admin.ts:256–286`; `shared/store.ts:88–91, 98–125`
- **Evidence:** `approveRedemption` computes `nextPoints = spendHeldStars(row.player.points, row.starsHeld)` = `max(0, points − held)` (281) and writes it directly, while the ledger records `SPEND_REWARD amount: row.starsHeld` (283–287) regardless of what was actually deducted. `POST /admin/players/:id/resources` sets `points` to any non-negative integer (256–265) *without* checking `starsHeldForPlayer`, so `points` can be driven below outstanding holds.
- **Impact:** Sequence: kid requests a 1000★ reward (hold), admin sets points to 100 via `/resources`, parent approves → `points` becomes 0 but ledger says 1000 spent; `walletFromLedger` and `Player.points` now disagree permanently and the kid received a reward for 100★. Reports/accolades that read the ledger will not match what the kid sees.
- **Recommendation:** Pick one source of truth. Either derive `points` from the ledger on read (the shared package already has `walletFromLedger`) or make `approveRedemption` throw if `points < starsHeld` and make `/resources` refuse to set points below held stars (or auto-release holds). Add an invariant check (`points === walletFromLedger(...).currentStars`) to `backfillStarLedgers`/a periodic job.

#### F-007 · Purgatory plots can be locked indefinitely by parent inaction
- **Area:** Gameplay · `apps/api/src/chores.ts`, `apps/api/src/routes/player.ts`
- **Where:** `chores.ts:283–296` (claim → `phase: "purgatory"`), `chores.ts:435–459` (`prunePlot` requires `state === "wilted"`), `player.ts:277–279, 357–359, 413–415` (water/fertilize/harvest reject purgatory)
- **Evidence:** A claimed chore places a `purgatory` seed on an empty plot. The kid cannot water, fertilize, harvest, or prune it; only `approveClaim`/`denyClaim` change its phase. There is no timeout, expiry, or kid-side cancel.
- **Impact:** If a parent forgets (or push isn't configured), the plot is dead until someone opens the inbox. With 9 plots and several chores per day, a kid can lock their whole garden.
- **Recommendation:** Add a configurable auto-resolve (e.g., auto-deny → wilted after N days, or allow the kid to "take back" a PENDING claim which deletes the claim and empties the plot). Surface pending age in the parent inbox.


#### F-008 · Denied chores are infinitely re-claimable → notification/inbox flooding
- **Area:** Gameplay / Abuse · `apps/api/src/chores.ts`, `apps/api/src/push.ts`
- **Where:** `chores.ts:393–405` (deny rewrites `periodKey` to `closedPeriodKey("DENIED", id)` and frees the race slot), `player.ts:529–535` (each claim triggers `notifyChoreClaimPending`)
- **Evidence:** The unique constraint `@@unique([choreId, playerId, periodKey])` (`schema.prisma:224`) is intentionally sidestepped on deny so a kid can retry. There is no cap on retries per period and no cooldown; every claim pushes to all parents.
- **Impact:** A kid can claim → get denied → prune → claim again endlessly, each time sending Web Push to every parent device. Also inflates `ChoreClaim`, `ActivityLog`, `PushActionToken` tables.
- **Recommendation:** Cap re-claims per (chore, player, period) (e.g., 2) and enforce a cooldown after deny; coalesce push notifications by `approvalTag` (already exists at `push.ts:36`) with a minimum interval.

#### F-009 · Chore proof photo is persisted *after* the claim commits
- **Area:** Gameplay integrity · `apps/api/src/routes/player.ts`
- **Where:** `player.ts:507–528`
- **Evidence:** `claimChore({ …, proofPath: null, hasProof: Boolean(proofBuf) })` (507–516) commits the claim (and awards the `chore_photo` accolade at `chores.ts:306–312`). Only then is `writeClaimJpeg` called (518) and `choreClaim.update({ proofJpegPath })` (524). Neither is in the transaction.
- **Impact:** If the disk write fails, the claim stands as PENDING with `hasPhoto: false` for a chore that `requiresSelfie`, the parent has nothing to review, and the accolade was already granted. Race: a parent can approve from push before the photo path lands.
- **Recommendation:** Write the JPEG to a temp path before the transaction, pass `proofPath` in, and `unlink` on failure; or do the write inside the transaction callback (already Serializable with retry; the claim id in the filename makes retries idempotent).

#### F-010 · Parent == Admin: no role separation
- **Area:** Architecture / AuthZ · `apps/api/src/routes/parent.ts`, `apps/api/src/auth.ts`
- **Where:** `parent.ts:5, 64–392` (every `/api/parent/*` route calls `requireAdmin`); `docs/phase-2-and-architecture.md:32,50`
- **Evidence:** The docs describe the Parent PWA as the "non-tech daily driver" distinct from Admin, but both share `AdminSession`. Any parent login can call `/api/admin/config`, `/grant-stars`, `/resources`, `/deactivate`, `/audit`.
- **Impact:** A second caregiver (grandparent, babysitter) given the parent PWA login has full administrative power, including minting unlimited stars. Audit logs record `adminId` but there is no way to scope a lower-privilege account.
- **Recommendation:** Add a `role` column on `Admin` (`owner` | `parent`) and gate `/api/admin/*` on `owner`. Keep `/api/parent/*` available to both.

#### F-011 · Permissive CORS with credentials
- **Area:** Web security · `apps/api/src/app.ts`, `apps/api/src/auth.ts`
- **Where:** `app.ts:24–27`; `auth.ts:25–32`
- **Evidence:** `await app.register(cors, { origin: true, credentials: true })` reflects any `Origin` header and allows credentials. Cookies are `httpOnly`, `sameSite: "lax"`, `secure: process.env.COOKIE_SECURE === "true"`.
- **Impact:** `SameSite=Lax` blocks cookies on cross-*site* `fetch`, which mitigates the classic attack today. But any *same-site* origin (another subdomain or port on the same host — e.g., a dev server or a second app on the family server) gets full credentialed read/write access, and Bearer tokens are accepted (`auth.ts:35`) so a leaked token is usable from any origin. The setting is unnecessary: all three frontends are same-origin via nginx.
- **Recommendation:** Set `origin` to an explicit allow-list from env (or `false`, since nginx makes everything same-origin) and consider `sameSite: "strict"` for the admin cookie.

#### F-012 · Edge exposes plaintext HTTP with no security headers
- **Area:** Deployment · `nginx/nginx.conf`, `.env.example`
- **Where:** `nginx.conf:23–25, 27–79`; `.env.example:12–13`
- **Evidence:** `listen 80; server_name _;` — no TLS block, no `add_header` for `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or CSP (the only `add_header`s are `Cache-Control`/`Service-Worker-Allowed` on `sw.js`, 66–67). `COOKIE_SECURE=false` by default.
- **Impact:** Session cookies and children's photos traverse the network in cleartext unless the operator adds a TLS proxy the repo does not ship. Web Push requires HTTPS anyway, so the feature set implicitly assumes one. Missing frame protection allows clickjacking of the parent Approve/Deny UI.
- **Recommendation:** Ship an HTTPS variant (Caddy, or nginx + certbot) or document the requirement prominently; add a baseline header set; default `COOKIE_SECURE` to `true` with an explicit opt-out for LAN dev.

#### F-013 · Internal error messages are relayed to clients as 400
- **Area:** Info disclosure / API hygiene · `apps/api/src/routes/*.ts`
- **Where:** e.g. `player.ts:334–337, 469–472, 545–548`; `admin.ts:342–345`; `parent.ts:225–228`
- **Evidence:** `catch (err) { const e = err as Error & { statusCode?: number }; return reply.code(e.statusCode ?? 400).send({ error: e.message }); }` — Prisma exceptions (`findUniqueOrThrow`, connection errors, constraint violations naming tables/columns) fall through with their raw message and a 400 status.
- **Impact:** Leaks schema details and misclassifies server faults as client errors (breaks monitoring and Fastify's default 500 logging).
- **Recommendation:** Only forward messages for errors that carry an explicit `statusCode` (your `httpError`); otherwise log and return a generic 500.

### Low


#### F-014 · Admin star grants / adjustments use `Date.now()` as idempotency key
- **Where:** `store.ts:441` (`grant:${playerId}:${Date.now()}:${amount}`), `admin.ts:278` (`adjust:${id}:${Date.now()}:${delta}`)
- **Evidence/Impact:** The key defeats the ledger's idempotency purpose; a double-clicked "Grant" mints twice. `appendStarEvent`'s uniqueness guard never trips for these kinds.
- **Recommendation:** Accept a client-supplied `requestId` (UUID) from the admin UI and use it in the key; disable the button while in flight.

#### F-015 · `/resources` clamp does not coerce input
- **Where:** `admin.ts:256–257`
- **Evidence:** `const clamp = (n, fallback) => Math.max(0, Math.floor(n ?? fallback))` — a string body value yields `NaN` → Prisma throws → surfaced via F-013 as a 400 with a raw message.
- **Recommendation:** `Number.isInteger(Number(n))` guard, 400 on failure.

#### F-016 · `/deactivate` semantics are surprising
- **Where:** `admin.ts:368–369`
- **Evidence:** `const isActive = active !== false ? Boolean(active) : false;` — omitting `active` deactivates (likely intended), but `{ active: "no" }` **re**activates because any non-empty string is truthy.
- **Recommendation:** `typeof active === "boolean"` check; 400 otherwise.

#### F-017 · Push action tokens live 7 days and survive resolution
- **Where:** `push.ts:22, 115–135, 287–294`; `apps/parent/public/sw.js:76–80`
- **Evidence:** `ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000`; `actorFromActionToken` checks only expiry, kind and subject. The bearer token is embedded in the notification payload (`push.ts:76, 87`) and sent by the service worker as `Authorization: Bearer`.
- **Impact:** Limited — approve/deny are idempotent through status checks (`chores.ts:338, 391`; `store.ts:279`), so replay after resolution is harmless. But a token captured from a device's notification log remains a valid approve/deny capability for up to a week while the subject is PENDING.
- **Recommendation:** Delete `PushActionToken` rows for a subject when it resolves (a `clear` push is already sent there) and shorten TTL to ~24 h to match the push TTL at `push.ts:146`.

#### F-018 · Unauthenticated `/api/farm` exposes children's names and PIN status
- **Where:** `farm.ts:9–32`
- **Impact:** Fine on a LAN; on the public internet it lists each child's first name, mascot, and whether they are PIN-protected. Also feeds F-002 enumeration.
- **Recommendation:** Return only what the lobby needs (id + mascot + display initial) or require a shared household cookie set by any prior login.

#### F-019 · Selfie/claim filenames embed the child's name
- **Where:** `selfie.ts:75–77, 88, 102`
- **Evidence:** `safeName(playerName)` is sanitised for the filesystem (good) but still places the child's name in a filename that lands in an Immich-watched folder.
- **Impact:** Privacy footprint in backups/photo libraries. Not a vulnerability; an operator note.
- **Recommendation:** Use `playerId.slice(0,8)` only, or make name inclusion opt-in.

#### F-020 · Session and action-token rows are never pruned
- **Where:** `schema.prisma:99–102, 233–236, 278–283` (indexes on `expiresAt` exist) — no `deleteMany({ expiresAt: { lt: now } })` found under `apps/api/src`.
- **Impact:** Slow table growth (`PlayerSession` on every kid login; `PushActionToken` per claim × parent).
- **Recommendation:** A startup + hourly sweep in `index.ts`.

### Informational

#### F-021 · API test suite fails in this checkout due to a missing dependency
- **Evidence:** `npm test -w @farmhand/api` → `ERR_MODULE_NOT_FOUND: Cannot find package 'web-push' imported from apps/api/src/push.ts`; `push.test.ts` fails, the other five API spec files pass (34/35). `web-push` is declared in `apps/api/package.json` and present in `package-lock.json`, but `node_modules/web-push` is absent locally — a stale install, not a repo bug. `@farmhand/shared` passes 46/46.
- **Recommendation:** `npm ci` at the root; add a CI job that runs the root `npm test` so this is caught.

#### F-022 · Positive: strong patterns worth preserving
- Serializable transactions + P2034 retry (`store.ts:20–32`, `chores.ts:214–327`) and `FOR UPDATE` row locking (`chores.ts:261`).
- Ledger idempotency keys tied to durable ids (`earn:harvest:${harvestLog.id}`, `hold:${row.id}`, `spend:${row.id}`).
- Token hashing at rest (`hashToken`) for player, admin, and push-action tokens; `httpOnly` cookies.
- Path-traversal guards on photo serving (`selfie.ts:111–123`: `basename === file`, `.jpg` suffix, per-player needle) and DB-stored absolute paths for claim proofs (`parent.ts:277–291`).
- JPEG magic-byte + SOF-marker validation before writing uploads (`selfie.ts:28–60`).
- Audit log on every admin/parent mutation.

#### F-023 · Docs drift: `fulfill` is a live alias
- `docs/phase-2-store.md:46,95` and `phase-2-parent-push.md:5` describe `/fulfill` as a legacy alias of approve; the route still exists (`parent.ts:353`) and the SW still maps `fulfill` → approve (`sw.js:76`). Harmless, but schedule removal to shrink the surface.

#### F-024 · Player frontend polls `/api/garden` every 5 s per open tab
- `apps/player/src/screens/Garden.tsx:105–114`. Each poll runs `syncPlayerPlots` + player fetch (`player.ts:104–114`). Fine for a household; note if `plotCount` is ever raised (see F-005) or many tabs are open on a shared tablet.


---

## 3. Gameplay gap checklist

| Area | Status | Notes |
|---|---|---|
| Harvest → stars | ⚠ | Double-harvest race (F-001). Only harvest and admin grant mint stars — good single funnel. |
| Watering gate (daily selfie) | ✅/⚠ | `selfieUnlockedOn` enforced (`player.ts:289–291`); per-plot cooldown + daily cap enforced but racy (F-001). |
| Selfie reward | ⚠ | One seed per day (`selfie.ts:71`) — correct; but unlimited uploads (F-004). |
| Chore claim → purgatory → approve/deny | ✅/⚠ | State machine is sound and row-locked; no timeout for purgatory (F-007); infinite re-claims (F-008); proof written post-commit (F-009). |
| RACE chores | ✅ | `ChoreRaceSlot` unique constraint + release on deny/harvest (`chores.ts:268, 403–405, 478–480`). |
| Store hold → approve → redeem | ✅/⚠ | Serializable, status-guarded; but `points` vs ledger divergence via admin `/resources` (F-006). |
| Ingredients & fertilizer | ⚠ | Daily claim OK; `mix` can go negative under concurrency (F-001). |
| Plot count changes | ⚠ | `syncPlayerPlots` grows plots on the fly; no upper bound (F-005). Shrinking `plotCount` leaves orphan plots with plants the UI will not render (`Garden.tsx:116–123` iterates `config.plotCount`). |
| Timezone day boundaries | ✅ | All day keys go through `todayKey(config.timezone)`; risk is only from invalid TZ config (F-005). |
| Session expiry | ✅/⚠ | Player session honours `sessionMinutes`; admin fixed 12 h; no sweep (F-020). |

---

## 4. Hotspots (where to focus refactoring/tests)

1. `apps/api/src/routes/player.ts` (≈700 lines) — six near-identical transaction bodies with duplicated validation ladders; extract a `withLockedPlot(playerId, slot, fn)` helper and use it to fix F-001 in one place.
2. `apps/api/src/routes/admin.ts` — config write path (F-005), resources/grant (F-006, F-014, F-015), deactivate (F-016).
3. `packages/shared/src/config.ts::mergeGameConfig` — the only validation choke point for tunables; currently a spread.
4. `apps/api/src/store.ts` + `packages/shared/src/store.ts` — dual balance representations.
5. `apps/api/src/selfie.ts` — upload lifecycle, retention, and naming.
6. Edge: `nginx/nginx.conf`, `docker-compose.yml`, `.env.example` — defaults and TLS.

---

## 5. Suggested remediation order

1. F-001 (row lock / Serializable on plot + ingredient mutations) — small change, closes the money bug.
2. F-002 + F-003 (rate limit `/enter` and `/admin/login`; refuse default bootstrap password in production).
3. F-004 (one selfie per day per player; retention sweep).
4. F-005 (schema-validate `PUT /api/admin/config`).
5. F-006 (single source of truth for stars; guard `/resources` against outstanding holds).
6. F-011/F-012 (CORS allow-list, security headers, `COOKIE_SECURE` default).
7. Remaining Medium/Low items as hygiene.

---

## 6. Out of scope / not verified

- Runtime penetration testing against a live deployment (all findings are from static reading plus a local unit-test run).
- Pixi rendering code under `apps/player/src/pixi/*` (tests present; not security-relevant).
- `hashSecret`/`verifySecret` algorithm parameters in `auth.ts` (not re-read this pass; confirm bcrypt/scrypt cost is production-grade).
- Immich integration behaviour on the shared drop directory.
- Prisma migration history and any raw SQL outside `chores.ts:261`.

