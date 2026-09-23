# FarmHand GrokBot Analysis
Date: 2026-09-10
Branch/commit: cursor/farmhand-monorepo-f3ca @ 6e29d39
Method: Local read-only audit on family machine (`C:\\Users\\theha\\Documents\\GIT\\FarmHand`). Sampled `apps/api` (auth, routes, chores, store, selfie, push, seed, Prisma schema), `packages/shared` config/economy, player/parent/admin entrypoints and Job Board/store identity flows, `docker-compose.yml`, `nginx/nginx.conf`, `.env.example`. No live pentest, no Docker run, no tablet QA. Follow-up concurrency pass re-read harvest/plant/approve/selfie/store/Job Board list filters. Cloud agent launch was usage-capped; GitHub `gh` was unauthenticated on the box.

## Executive summary
Overall posture for a **self-hosted home-LAN family deploy** is **good on chore-claim locking and store ledger paths**, weaker on **auth hardening, public farm leakage, and several non-Serializable garden mutations**. Happy-path economy matches the locks (harvest-only ★, chore → purgatory seed, flat 1/24h/25★ defaults). A deeper concurrency pass found a **Critical double-harvest race** and related plant/approve races that can inflate stars/seeds under parallel requests (scripted client or double-tap).

**Top 5 must-fix**
1. **Double harvest can mint duplicate ★ + seeds** — `POST /api/plots/:slot/harvest` lacks plot row lock / Serializable (Critical).
2. **No PIN rate limiting** on `POST /api/players/:id/enter` — 4-digit PINs are trivially brute-forced on the LAN.
3. **Default bootstrap secrets** (`admin` / `farmhand-dev`, Postgres `farmhand`) — change before any non-localhost exposure.
4. **Concurrent plant / dual-parent approve+deny races** — plant lacks `FOR UPDATE`; approve/deny check-then-update without conditional status transition.
5. **Sticky kid/admin sessions on the shared tablet** — spend/jobs skip re-PIN if `fh_player` exists; uncleared `fh_admin` opens parent/admin to kids (F-025/F-026). Also `/api/farm` leakage, QA routes, dead chore flags.

Severity counts: **Critical 1 · High 6 · Medium 11 · Low 8 · Info 3**

*Amendments 2026-09-10 evening: (1) gameplay concurrency; (2) frontend/shared-tablet sessions (F-025/F-026), 3-garden cap, type drift.*

## Findings

### F-001 No rate limit on garden PIN entry
- Severity: High
- Area: Security
- Where: `apps/api/src/routes/player.ts` → `POST /api/players/:id/enter`; `apps/api/src/auth.ts` (`verifySecret`)
- Evidence: PIN checked with bcrypt; no rate-limit / lockout / backoff anywhere in `apps/api` (grep for rateLimit/throttle = 0). PIN space is `\\d{4}` (10k).
- Impact: Another kid or guest on the home network can script PIN guesses and take over a garden session (`fh_player` cookie).
- Recommendation: Per-player (and/or per-IP) attempt budget with exponential backoff; optional temporary lockout; consider longer PIN or device-pairing for older kids.

### F-002 Weak default admin and DB credentials
- Severity: High
- Area: Security / Infra
- Where: `.env.example`; `docker-compose.yml` (`ADMIN_BOOTSTRAP_*`, `POSTGRES_*`); `apps/api/src/seed.ts` (`seedIfEmpty`)
- Evidence: Defaults `ADMIN_BOOTSTRAP_USER=admin`, `ADMIN_BOOTSTRAP_PASSWORD=farmhand-dev`, Postgres user/password `farmhand`. Seed creates admin only when `admin.count === 0`, then never rotates.
- Impact: If Compose is left on defaults and port 80 is reachable beyond the trusted LAN (or a guest joins Wi‑Fi), parent/admin takeover is trivial. Same cookie gates parent + admin.
- Recommendation: Require strong bootstrap password at first boot (refuse known defaults in `NODE_ENV=production`); document forced change; keep Postgres unpublished (already not port-mapped — good).

### F-003 Unauthenticated farm snapshot leaks kid economy
- Severity: Medium
- Area: Security / Gameplay
- Where: `apps/api/src/routes/farm.ts` → `GET /api/farm`; consumed by `apps/player/src/screens/FarmDashboard.tsx`
- Evidence: Public response includes per-player `seeds`, `points`, `fertilizer`, serialized plots, `hasPin`, `canWater`. No session required.
- Impact: On a shared tablet/LAN, anyone can poll balances and plot readiness without identifying as a kid — spoils surprise and enables griefing decisions.
- Recommendation: Return mascot/name/unlocked flags for the playfield; gate detailed inventory behind session or a coarser public card.

### F-004 Demo kid PINs seeded in empty DBs
- Severity: Medium
- Area: Security
- Where: `apps/api/src/seed.ts` (`DEMO_KIDS` Willow/1111, Finn/2222, Sage/3333)
- Evidence: Logged at seed time; PINs are well-known sequences.
- Impact: Fresh family deploy that keeps demo kids is PIN-guessable without tooling.
- Recommendation: Seed without PINs (force parent set), or randomize and print once; never use trivial patterns.

### F-005 Player QA screens shipped in production routes
- Severity: Medium
- Area: Design / Code
- Where: `apps/player/src/App.tsx` routes `/qa/garden`, `/qa/farm`, `/qa/ui` → `GardenQa`, `FarmQa`, `UiPolishQa`
- Evidence: Always registered in the player SPA router; not gated by env.
- Impact: Kids/guests can open debug/QA surfaces on the wall tablet; risk of confusion and accidental non-prod tooling in a “finished” build.
- Recommendation: Compile-out behind `import.meta.env.DEV` or admin flag; remove from release builds.

### F-006 `requiresApproval=false` ignored on claim
- Severity: Medium
- Area: Gameplay
- Where: `apps/api/src/chores.ts` `claimChore` / `approveClaim`; field set in `parentChoreWrite.ts` / catalog
- Evidence: `requiresApproval` is stored and returned on public chore DTOs but `claimChore` always inserts `status: "PENDING"` and plot `phase: "purgatory"`. No branch auto-approves when false.
- Impact: Parent UI can imply “no OK needed” while kids still wait in purgatory — product lie / support confusion.
- Recommendation: If false, auto-run approve path inside the claim transaction (or disallow toggling until implemented).

### F-007 Full game config exposed on public farm endpoint
- Severity: Medium
- Area: Security / Design
- Where: `GET /api/farm` returns `config` (`packages/shared` `GameConfig` including watering caps, session length, tier table)
- Evidence: `FarmDashboard` stores config for poster dwell etc.; no auth.
- Impact: Tunables and economy numbers are scrapable; low confidentiality need, but couples public playfield to admin knobs and enlarges attack/cheat surface for scripted clients.
- Recommendation: Split public playfield config vs admin config; send only fields the Pixi farm needs.

### F-008 CORS `origin: true` + credentials
- Severity: Low
- Area: Security
- Where: `apps/api/src/app.ts` `@fastify/cors` `{ origin: true, credentials: true }`
- Evidence: Reflects any Origin. Cookies use `sameSite: "lax"`, `httpOnly: true`, `secure` from `COOKIE_SECURE`.
- Impact: For classic cross-site cookie theft, SameSite=lax blocks credentialed XHR from random websites. Residual risk if a same-site XSS or mis-bound host appears. Overly permissive for a locked family host allowlist.
- Recommendation: Allowlist the nginx host(s) (`player`/`parent`/`admin` origins) instead of reflecting all.

### F-009 Push action tokens are long-lived bearer approve/deny
- Severity: Low
- Area: Security
- Where: `apps/api/src/push.ts` (`ACTION_TTL_MS` = 7d, `actorFromActionToken`); `apps/api/src/routes/parent.ts` `requireParentActor`
- Evidence: Raw token embedded in Web Push payload; hashed at rest; bound to kind+subjectId; approve/deny still enforce PENDING.
- Impact: Anyone who can read the push payload (compromised phone backup, noisy notification mirroring) can approve/deny that subject until expiry or resolution. Acceptable for many families; worth knowing.
- Recommendation: Shorten TTL; single-use consume on success; prefer opening inbox with session for non-critical chores.

### F-010 `COOKIE_SECURE=false` default
- Severity: Low
- Area: Infra
- Where: `.env.example`, Compose `COOKIE_SECURE: ${COOKIE_SECURE:-false}`, `auth.ts` `cookieOpts`
- Evidence: Documented for local HTTP. nginx listens only on `:80` (no TLS in-tree).
- Impact: Correct for LAN HTTP; cookies can be sniffed if the family ever puts this on a hostile network path without TLS.
- Recommendation: When adding HTTPS termination, force `COOKIE_SECURE=true` and fail closed if mismatched.

### F-011 Open-PIN gardens (null `pinHash`)
- Severity: Low
- Area: Security / Gameplay
- Where: `POST /api/players/:id/enter` skips PIN when `!player.pinHash`; admin `reset-pin` can clear
- Evidence: Session minted with no secret.
- Impact: Intentional for toddlers, but any tablet user can act as that kid (spend stars, claim chores into their garden).
- Recommendation: Keep; surface loudly in admin UI (“open garden”); consider confirming on store spend.

### F-012 Shared `fh_admin` for parent and admin apps
- Severity: Info
- Area: Design / Security
- Where: `auth.ts` `ADMIN_COOKIE`; parent routes use `requireAdmin` / `getAdminSession`
- Evidence: By design one bootstrap admin. Login clears the other cookie family (`PLAYER_COOKIE` ↔ `ADMIN_COOKIE`).
- Impact: Fine for single-household; no role separation if you later add a babysitter vs full admin.
- Recommendation: Document; split roles only if a second adult with fewer powers is needed.

### F-013 Selfie/chore JPEG path handling looks safe
- Severity: Info
- Area: Security
- Where: `apps/api/src/selfie.ts` (`isPlayerSelfieBasename`, `selfieFilePath`, `writeSelfieJpeg`); parent claim photo streams `proofJpegPath` from DB after admin auth
- Evidence: Basename-only join; rejects `..`; player selfie URLs require session + id needle match.
- Impact: No path-traversal finding in the sampled upload/serve path.
- Recommendation: Keep storing claim paths as server-generated absolute paths under the drop dir only.

### F-014 Chore claim + store redeem locking is strong; garden mutations are not
- Severity: Info
- Area: Gameplay / Code
- Where: `chores.ts` `claimChore` (Serializable + `FOR UPDATE` + unique claim/race slots); `store.ts` hold/spend/deny with Serializable + ledger idempotency keys
- Evidence: Double-claim maps P2002 → friendly error; store status gates + ledger idempotency. Contrast: harvest/plant/selfie/approveClaim/denyClaim — see F-017–F-020.
- Impact: Claim/store paths are the gold standard to copy; unlocked mutations are the residual economy risk.
- Recommendation: Apply the claimChore locking pattern to harvest/plant/selfie and conditional updates to approve/deny.

### F-015 Plant transaction lacks plot row lock (superseded detail in F-018)
- Severity: High
- Area: Gameplay
- Where: `apps/api/src/routes/player.ts` `POST /api/plots/:slot/plant`
- Evidence: Checks `plot.plantTier` then decrements seeds without plot `FOR UPDATE` / Serializable (unlike `claimChore`).
- Impact: Concurrent plant can double-spend pouch seeds or clobber plot state.
- Recommendation: Same locking pattern as chore claim (`FOR UPDATE` on plot + Serializable retry).

### F-016 Admin login has no rate limit
- Severity: Medium
- Area: Security
- Where: `apps/api/src/routes/admin.ts` `POST /api/admin/login`
- Evidence: Username/password bcrypt check only; no lockout.
- Impact: Combined with F-002 defaults, online guessing is easy from the LAN.
- Recommendation: Same rate-limit middleware as PIN entry; alert on repeated failures.

## Gameplay gap checklist

| Rule / surface | Status | Notes |
| --- | --- | --- |
| Crops flat 1 seed / 24h / 25★ | Gap | Defaults + legacy flatten Pass; admin non-legacy edits can persist non-flat tiers (F-022); harvest race can break 25★/harvest (F-017) |
| 1★ = 1¢ (points as stars) | Pass | Wallet treats `points` / `currentStars` together; store `starCost` |
| Stars from harvest only (not chore claim) | Pass / Gap | Happy path Pass; concurrent harvest can mint duplicate `EARN_HARVEST` (F-017) |
| Chore claim → 1 provisional seed in purgatory | Pass / Gap | Claim path Pass + well locked; dual-parent approve/deny race (F-019); `includeInPath` ignored (F-021) |
| Parent approve → growing / deny → wilted + prune | Pass | `approveClaim` / `denyClaim` + player prune |
| Store browse without PIN | Pass | `GET /api/store/catalog` + `StoreSheet` loads catalog first |
| Store spend identity (PIN/session) | Pass | `ensureIdentity` → `WhoseKidPicker` / session before request |
| Job Board family browse then identify | Pass | `FarmJobFlow` coach → family board → identify → kid board |
| Empty Job Board copy | Pass | “No open jobs right now…” |
| Selfie unlocks watering; chore photo ≠ watering selfie | Pass / Gap | Rules Pass; same-day selfie seed grant race (F-020) |
| Daily selfie seed grant | Pass | `planSelfieReward` / `selfieSeedGrantDate` |
| Profile / star ledger | Pass | Ledger kinds + idempotency; profile route session-gated |
| `requiresApproval` / `includeInPath` flags | Gap | Stored but not enforced on claim / Job Board list |
| Multi-kid shared device session | Gap | Sticky `fh_player` skips re-PIN on store/jobs (F-025); uncleared `fh_admin` exposes parent/admin (F-026) |
| Offline / refresh | Unknown | PWA bits on parent; player farm polls every 8s — no offline queue audit |


### F-017 Double harvest can mint duplicate ★ + seeds
- Severity: Critical
- Area: Gameplay
- Where: `apps/api/src/routes/player.ts` → `POST /api/plots/:slot/harvest`
- Evidence: Harvest uses a plain `$transaction` (default Read Committed). No plot `FOR UPDATE`, no Serializable, no conditional clear. Two concurrent requests can both see `serialized.ready`, both increment points/seeds, both append `EARN_HARVEST` (new `activityLog.id` → new idempotency keys).
- Impact: Breaks locked “25★ per harvest” / seed-neutral plant→harvest; inflates store purchasing power (scripted double-tap or parallel clients).
- Recommendation: Serializable + plot row lock (or `UPDATE … WHERE plantedAt IS NOT NULL … RETURNING`), award only if one row cleared.

### F-018 Concurrent plant can double-spend pouch seeds
- Severity: High
- Area: Gameplay
- Where: `POST /api/plots/:slot/plant` (see also F-015)
- Evidence: Same missing lock pattern as pre-amendment F-015; deeper pass confirmed double-spend / clobber risk under concurrency.
- Impact: Race can charge 2× seeds while one plant remains.
- Recommendation: Mirror `claimChore` (`FOR UPDATE` + Serializable retry).

### F-019 Approve-after-deny / dual-parent claim resolve race
- Severity: High
- Area: Gameplay
- Where: `apps/api/src/chores.ts` `approveClaim` / `denyClaim`
- Evidence: Both read `status !== "PENDING"` then unconditional `update`. Not Serializable; no `updateMany({ where: { id, status: "PENDING" }})`. Concurrent approve+deny (inbox + push action token) can both pass the check.
- Impact: Plot can end wilted after approve (or growing after deny); race slot / periodKey side effects can disagree with final status.
- Recommendation: Conditional status transition + Serializable (mirror store redeem path).

### F-020 Selfie same-day double-seed race
- Severity: Medium
- Area: Gameplay
- Where: `POST /api/selfie` + `planSelfieReward`
- Evidence: Plan reads `selfieSeedGrantDate !== today` then increments seeds in a non-Serializable tx with no player row lock. Concurrent posts can both grant +1 seed.
- Impact: Extra free seeds → extra plants → extra ★.
- Recommendation: Lock player row / conditional update `WHERE selfieSeedGrantDate IS DISTINCT FROM today`.

### F-021 `includeInPath` ignored by Job Board APIs
- Severity: Medium
- Area: Gameplay
- Where: `listFamilyOpenChores`, `listPlayerChores`; parent “Show on Job Board” in `parentChoreWrite.ts`
- Evidence: Field stored/serialized but never filtered; corkboard and kid board still return `includeInPath: false` chores.
- Impact: Parent cannot hide chores from Job Board; density controls don’t work.
- Recommendation: Filter `includeInPath === true` (keep inactive filter).

### F-022 Flat crop economy not hard-enforced after admin edit
- Severity: Medium
- Area: Gameplay
- Where: `packages/shared/src/config.ts` `mergeGameConfig`; admin `PUT /api/admin/config`
- Evidence: Defaults + legacy boot-merge force 1/24h/25★; non-legacy custom tier economy fields are preserved.
- Impact: Product lock can be silently broken without Reset.
- Recommendation: Clamp tier economy to flat constants on save, or separate aesthetic fields from locked payout knobs.

### F-023 Store afford/spend uses `Player.points` cache vs ledger wallet
- Severity: Medium
- Area: Gameplay
- Where: `requestStoreSku` / `approveRedemption` vs `playerWallet`
- Evidence: Afford/spend use `player.points` + held; profile uses ledger. Admin resource SET under an open hold can diverge UI wallet vs spendable balance vs `SPEND_REWARD` ledger lines.
- Impact: Incorrect affordability or ledger/profile mismatch after admin adjust under holds.
- Recommendation: Gate and spend from `playerWallet` / availableStars inside the same Serializable tx.

### F-024 Chore proof JPEG written after claim commit
- Severity: Low
- Area: Gameplay
- Where: `POST /api/chores/:id/claim`
- Evidence: `claimChore` commits with `hasProof`, then `writeClaimJpeg` + path update outside the tx.
- Impact: Failure → PENDING claim without photo; kid burned a plot/period.
- Recommendation: Write temp file first, or compensating deny/release on write failure.


### F-025 Sticky kid session reused for store spend / job claim
- Severity: High
- Area: Security / Gameplay
- Where: `apps/player/src/components/StoreSheet.tsx` (`ensureIdentity`); `FarmJobFlow.tsx` (`startClaim`); `api.logout` unused on browse-without-kid / leave garden
- Evidence: If `api.session()` already has a player, spend/waiting/owned and farm job claim skip `WhoseKidPicker`/PIN. Local “browse without a kid” clears UI state only — does not call `POST /api/session/logout`. README documents ~30-minute sticky session.
- Impact: On the shared Samsung tablet, sibling B can spend A’s stars or plant waiting seeds in A’s garden without re-identifying after A’s PIN window.
- Recommendation: Always confirm identity (or force re-PIN when actor changes) before spend/claim; wire leave-garden / browse-anonymous to `logout`.

### F-026 Uncleared parent/admin cookie on shared tablet
- Severity: High
- Area: Security
- Where: `apps/api/src/auth.ts` (`fh_admin`, 12h); `routes/admin.ts` login; `routes/player.ts` enter clears admin cookie — farm browse does not
- Evidence: Parent/admin share one bootstrap cookie on path `/`. Logging into parent on the wall tablet without Sign out leaves `/parent/` and `/admin/` reachable. Kid garden enter clears admin cookie; idle farm playfield does not.
- Impact: Kids can open parent inbox / admin tunables and approve chores or store requests if a grown-up used the tablet and walked away.
- Recommendation: Auto-clear `fh_admin` when loading the player PWA; shorter parent session; prominent Sign out; consider separate cookie path/name for parent vs admin.

### F-027 Farm Pixi hard-capped at 3 gardens
- Severity: Medium
- Area: Design / Gameplay
- Where: `apps/player/src/pixi/FarmScene.ts` (loop capped at 3 beds)
- Evidence: Admin can create more players; playfield only wires three garden hotspots.
- Impact: 4th+ kid invisible/unreachable from the farm scene.
- Recommendation: Document max 3 or paginate beds; don’t silently drop extras.

### F-028 Client API types drift from `@farmhand/shared`
- Severity: Medium
- Area: Code / Design
- Where: `apps/player/src/api.ts`, `apps/parent/src/api.ts`
- Evidence: Duplicated wallet/store/chore shapes; dual `heldStars` + `starsHeld` on player client; parent imports almost no shared types.
- Impact: Contract drift across surfaces.
- Recommendation: Export API DTOs from shared; delete local duplicates.

## Hotspots worth a second pass
- `apps/api/src/routes/player.ts` harvest/plant/selfie — add locks (F-017/018/020)
- `apps/api/src/chores.ts` approve/deny conditional transitions (F-019) + period keys / race slots
- `apps/api/src/store.ts` + `packages/shared/src/store.ts` — held vs spend math, backfill ledger
- `apps/api/src/game.ts` — plot sync / publicPlayer privacy flags
- `apps/player/src/pixi/*` — tablet perf (asset churn, ticker leaks); only lightly sampled
- `apps/parent/public/sw.js` + push action UX — notification action security
- Admin `PUT /api/admin/config` — merge/validation of hostile JSON knobs
- nginx TLS / multi-host hardening if exposed beyond LAN

## Out of scope / not verified
- Live HTTP/TLS pentest, CSRF browser proof, or push-payload interception
- Samsung tablet performance/QA of Pixi scenes and camera selfie quality gates in `selfieQuality.ts`
- Whether production `.env` on the family host still uses bootstrap defaults (did not read secrets)
- Full test suite execution (`vitest`/`npm test`) and CI status
- Immich integration for selfie drop dir
- Commit/push of this file (write-only deliverable this pass; ask if you want it committed)
