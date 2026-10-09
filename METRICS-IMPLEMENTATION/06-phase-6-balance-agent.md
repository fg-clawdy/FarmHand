# Phase 6 — Venice balance agent: read-only recommendations + parent review/apply workflow

Paste this entire document into a fresh agent session. Work in the repo root
`c:\Users\theha\Documents\GIT\FarmHand`.

## Objective

Add a **scheduled, read-only** "gaming balance" agent on top of the metrics pipeline built in
Phases 1–5. Each run it reads a metrics snapshot (tunable knobs + 7d/30d economy/mix windows),
asks Venice AI — the **Jev decision model** plus a **reasoning LLM** — to propose small,
justified tuning deltas against `GameConfigRow`, and stages those proposals in new **append-only**
tables. The parent reviews them in a new parent-PWA page (reached from a single informational
push notification — **no one-tap actions; page review is required first**) and applies them four
ways: (a) apply all remaining, (b) apply one at a time, (c) discuss/amend using added context,
(d) manually override a value before applying. Applying is a **scoped write** that performs a
three-way merge and reuses the existing `saveConfig`.

**Prerequisite:** Phases 1–5 are complete (`computePointsFromLedger` in shared, the
`PointLedgerEvent` + `SystemAlert` + `PointsReconciliationRun` tables, `balanceKnobs` /
`windowStats` / `economyFromLogs` in `apps/api/src/adminStats.ts`, and the running API).

## Invariants (do not violate)

1. **Read-only @ the game:** the agent (and its apply endpoint) may write **only** the new
   recommendation tables. It never writes `GameConfigRow`/`Player` from the scheduled run. The
   single place game config changes is `saveConfig` (through the apply endpoint).
2. **Append-only recommendations:** a recommendation set is created with status `OPEN` and
   transitions to `RESOLVED`/`SUPERSEDED`; tuning changes are created `PENDING` and move to
   `APPLIED`/`DISMISSED`/`SUPERSEDED`. Nothing is mutated in place — revise = supersede.
3. **Three-way merge on apply:** every apply compares `baselineValue` (what the model saw) vs the
   **current** live config vs `proposedValue`. Never silently overwrite a value the parent changed
   since the recommendation; surface a conflict instead.
4. **Clamp & validate before write:** apply runs the delta through `mergeGameConfig` **plus** the
   missing config validation (finite numbers, in-range, known keys — see Step 4) so a malformed or
   negative value can never corrupt the economy (`FABLE_ANALYSIS.md` already flagged this gap).
5. **Soft-miss on missing key:** if `METRICS_VENICE_API_KEY` is absent, the run logs a warning and
   produces no recommendations (mirror `jarArt.ts`). No crash, no retry storm.
6. **Review-first notifications:** the push is informational only (`type: "info"`) and deep-links
   to the recommendations page. No `approve`/`deny` buttons, no action token, **no** change to
   `ApprovalSubjectKind`.
7. **Own Venice key:** use `METRICS_VENICE_API_KEY`, never the image-generation `VENICE_API_KEY`.

## Model strategy (apply exactly)

Two-layer judgments on one Venice account:

| Layer | Model | Purpose | Endpoint |
|---|---|---|---|
| Judge | `jev-latest` (Jev decision model) | triage drift, pick which knob (+ direction), severity/confidence | `POST /api/v1/decisions` (alias `/api/v1/systemone`) |
| Reasoner | `deepseek-v4-pro` (resolved via traits `default_reasoning`) | synthesize rationale, draft the typed delta, run the "discuss" chat | `POST /api/v1/chat/completions` |
| Explainer | `deepseek-v4-flash` (cheap, `private` tier) | expand each change into one plain-language sentence | `POST /api/v1/chat/completions` |

Jev gives **typed** answers — `noul` (yes/no probability), `choice` (probability distribution over
named options), `score` (position on an ordered rubric) — each with a `confidence`. Use:
- **triage** (`noul`): "Does the 7d/30d economy drift from `balanceGoals`?" — `confidence ≥ 0.9`
  proceed, `0.6–0.9` mark the set "review recommended", `< 0.6` skip/downgrade.
- **knob/direction** (`choice`) over options like `tiers[1].seedCost up`, `tiers[1].points up`,
  `wateringCooldownMinutes down`, `no change`.
- **severity** (`score`) on rubric `["Cosmetic","Noticeable","Economy-breaking"]`.

**LLMs are still required** for the human parts (rationale prose, the multi-turn "discuss", and
emitting a strict JSON delta). Jev does not do open-ended prose or long dependent chains. Resolve
the LLM IDs from `GET /models/traits?type=text` (keys `default_reasoning`, `function_calling_default`)
at boot so they track the catalog; do not hard-code the reasoning model ID. Do **not** call
`GET /api/v1/models` with a placeholder key for Jev — confirm `jev-latest` against your own key
(`GET /models?type=decision`).

**Jev contract note:** the request/response field names for the decisions endpoint are defined in the
Jev docs (consult `/decisions/systemone`, `/decisions/create`, and the decisions feature guide
before coding). Isolate that mapping behind one module (`balanceDecision.ts`) that returns a
stable internal shape:

```ts
export type DecisionAnswer =
  | { kind: "noul"; probability: number }
  | { kind: "choice"; label: string; distribution: Record<string, number> }
  | { kind: "score"; rating: string; scores: Record<string, number> };
export type DecisionResult = { answer: DecisionAnswer; confidence: number; usage?: unknown };
```

If the decisions endpoint is unavailable/beta-blocked (401/404), **fall back** to the LLM forced
into the same JSON shape (a single reasoning call returning `{ triage, knob, severity, confidence }`)
and stamp the set's `modelIds.decision = "llm-fallback"`. Never crash on this path.

## Step 1 — New Prisma models + migration

Add to `apps/api/prisma/schema.prisma`:

```prisma
enum RecommendationSetStatus {
  OPEN
  RESOLVED
  SUPERSEDED
}

enum TuningChangeStatus {
  PENDING
  APPLIED
  DISMISSED
  SUPERSEDED
}

/// One balance-agent run. `snapshot` is the immutable window the model saw (for review/discuss).
model RecommendationSet {
  id         String                   @id @default(uuid())
  status     RecommendationSetStatus  @default(OPEN)
  snapshot   Json                     // balanceKnobs + 7d/30d windows + balanceGoals fingerprint
  modelIds   Json                     // { decision, text, explain }
  summary    String                   // plain-language headline, e.g. "Corn is too cheap vs its payoff"
  notifiedAt DateTime?
  createdAt  DateTime                 @default(now())
  updatedAt  DateTime                 @updatedAt
  changes    TuningChange[]

  @@index([status, createdAt])
}

/// A single proposed knob delta, addressed by JSON path into GameConfigRow.data.
model TuningChange {
  id               String             @id @default(uuid())
  setId            String
  set              RecommendationSet  @relation(fields: [setId], references: [id], onDelete: Cascade)
  path             String             // e.g. "tiers[1].seedCost", "wateringMaxPerDay"
  label            String             // e.g. "Corn seed cost"
  unit             String             // "stars" | "minutes" | "count" | "ratio"
  baselineValue    String             // JSON-encoded value the model saw
  proposedValue    String             // JSON-encoded proposed value
  appliedValue     String?            // JSON-encoded value actually written (override aware)
  rationale        String             // short human reason
  status           TuningChangeStatus @default(PENDING)
  sortOrder        Int                @default(0)
  appliedAt        DateTime?
  appliedByAdminId String?
  createdAt        DateTime           @default(now())

  @@index([setId, status, sortOrder])
}
```

`baselineValue`/`proposedValue`/`appliedValue` are **JSON-encoded strings** (tolerates numbers,
strings, arrays). Provide `getPath(obj, path)` / `setPath(obj, path, value)` helpers (split on `.`,
support `tiers[1]` array segments with a positive integer index; throw on an unknown path).

Generate + apply (from `apps/api`):
```
npx prisma migrate dev --name recommendation_queues
npx prisma generate
```
This migration is purely additive (new tables) and safe to apply as-is.

## Step 2 — Venice client + config (`METRICS_VENICE_*`)

New file `apps/api/src/balanceVenice.ts` (mirror the `jarArt.ts` fetch/soft-miss style):

- Read `METRICS_VENICE_API_KEY` (required), `METRICS_VENICE_DECISION_MODEL` (default `jev-latest`),
  and resolve `METRICS_VENICE_TEXT_MODEL` / `METRICS_VENICE_EXPLAIN_MODEL` via the traits endpoint
  (fallbacks `deepseek-v4-pro` / `deepseek-v4-flash`).
- `decision(opts)` → POST `https://api.venice.ai/api/v1/decisions` with the Jev questions described
  above; returns `DecisionResult` (mapped by `balanceDecision.ts`).
- `chat(messages, { json })` → POST `https://api.venice.ai/api/v1/chat/completions`, supporting a
  JSON-schema response (function calling) for the delta; return text or parsed JSON.
- Every call uses `AbortSignal.timeout(...)` and the `Authorization: Bearer` header; treat 4xx/5xx,
  network, and parse errors as a soft miss (log warn, return a result the caller treats as "no
  recommendation this run").

## Step 3 — The agent service (`apps/api/src/balanceAgent.ts`)

New module + a scheduler hook mirroring `startChoreHeatNightlySchedule` (see `choreHeat.ts`) and
the `startWishlistWeeklySchedule` call in `index.ts`.

```ts
export async function runBalanceAgent(force = false): Promise<{ created: boolean; setId?: string }>;
export function startBalanceAgentSchedule(log: unknown): void;
```

`runBalanceAgent`:
1. **Soft-miss** if `METRICS_VENICE_API_KEY` is missing.
2. Build the **snapshot** by reusing `balanceKnobs(config)`, `windowStats(logs, config)`, and
   `economyFromLogs(logs, config)` from `adminStats.ts` (7d *and* 30d windows), plus the current
   `balanceGoals` string. This is what the model sees and what later "discuss" anchors on.
3. **Idempotency:** skip if a `RecommendationSet` for the same `todayKey(timezone)` already exists
   (unless `force`), so a restart doesn't spam. Store the run `snapshot` and `modelIds`.
4. **Judge:** call Jev (triage/knob/severity), then the **reasoner** LLM to emit a strict JSON
   delta `{ changes: [{ path, proposedValue, rationale, unit, label }] }`. Ask for at most a handful
   of knobs (2–4). Only knobs surfaced by `balanceKnobs` are eligible (tier `seedCost`/`points`/
   `durationMinutes`, watering params, `shardsPerSeed`, seed reward bands, `mixYield`,
   `startingSeeds`/`startingPoints`, `plotCount`) — never arbitrary keys.
5. **Persist** one `RecommendationSet` + its `TuningChange` rows (status `PENDING`, `sortOrder`),
   capturing `baselineValue` from the live config at run time.
6. **Notify** via `notifyRecommendationsReady(setId, count)` (Step 6), stamping `notifiedAt`. Only
   notify when a **new** set is created.
7. On decision failure or when confidence `< 0.6`, produce **no** changes (log and return
   `{ created: false }`).

Register in `apps/api/src/index.ts` after `startChoreHeatNightlySchedule(...)`:
```ts
startBalanceAgentSchedule(app.log);
```

## Step 4 — Config validation (close the `FABLE_ANALYSIS.md` gap) + apply primitive

New file `apps/api/src/tuning.ts`:

```ts
export function validateTuningValue(path: string, value: unknown): string | null; // error message or null

export type TuningApplyOutcome =
  | { ok: true; applied: number; skipped: Array<{ id: string; reason: "conflict" | "already_applied" | "invalid" }> }
  | { ok: false; reason: string };

export async function applyTuningChanges(
  changes: { path: string; baselineValue: unknown; proposedValue: unknown; id?: string }[],
  opts: { force?: boolean; adminId?: string },
): Promise<TuningApplyOutcome>;
```

`validateTuningValue` enforces, **before** any write:
- values are finite numbers (no `NaN`/`±Infinity`/numeric strings) for numeric paths;
- `plotCount ∈ [9, 36]`; minutes/days counts `≥ 1`; tier `points`/`seedCost`/`durationMinutes` `≥ 0`;
- `tier` indices are within the live tiers array; unknown paths are rejected.

`applyTuningChanges`:
1. Load live `config = await loadConfig()`.
2. For each change, `current = getPath(config, path)`. If `current` deep-equals `proposedValue`
   → `already_applied` (no-op). Else if `current !== baselineValue` and `!opts.force` →
   `conflict` (do not write). Else if `validateTuningValue` rejects → `invalid`.
3. Build the merged config: apply each accepted change's `proposedValue` (or the caller's override)
   via `setPath`, then `mergeGameConfig`. Persist with `saveConfig(merged)` **once**.
4. Stamp each applied change (`status=APPLIED`, `appliedValue`, `appliedAt`, `appliedByAdminId`),
   and set the parent set to `RESOLVED` when nothing remains `PENDING`. Write an `AuditLog` row
   (`action: "apply_recommendations"`, `details` = applied changes + the previous knob values).

## Step 5 — Read endpoints + scoped apply/discuss routes (`apps/api/src/routes/parent.ts`)

Add these to `parentRoutes` (existing `requireAdmin` auth):

- `GET /api/parent/recommendations` → `{ sets: latest sets (OPEN first), pendingChanges: number }`.
- `GET /api/parent/recommendations/:id` → the set + its `TuningChange`s (`PENDING`/`APPLIED` with
  the live `currentValue` computed per change so the UI can render the diff/conflict badge).
- `POST /api/parent/recommendations/:id/apply` — **apply all remaining** (feature a): body
  `{ force?: boolean }`; calls `applyTuningChanges` over still-`PENDING` changes.
- `POST /api/parent/recommendations/:id/changes/:changeId/apply` — **apply one** (feature b). Body
  may include `{ override }` to satisfy feature (d).
- `POST /api/parent/recommendations/:id/discuss` — **discuss/amend** (feature c): body
  `{ message }`. Calls the **reasoner** LLM anchored to the set + its snapshot + `balanceGoals` +
  the parent's message; returns `{ reply, revised?: { changeId, proposedValue, rationale } }`.
  Persist any revised values as **new** `TuningChange` rows (status `PENDING`, superseding the old
  by marking it `SUPERSEDED`), never in-place.
- `POST /api/parent/recommendations/:id/changes/:changeId/apply` with body `{ override }` (or a
  dedicated `PATCH .../override`) — **manual override then apply** (feature d): the applied value is
  `override` (validated), written through the same `applyTuningChanges` path with `appliedValue =
  override` and `rationale` annotated `"(manual override)"`.

Features (a) and (b)/(d) all flow through `applyTuningChanges`, so "apply all remaining" naturally
skips anything the parent already applied one-at-a-time (its `current == proposedValue` → no-op)
and reports conflicts without clobbering manual edits.

## Step 6 — Push notification (review-first, no actions)

In `apps/api/src/push.ts` add a builder + notifier mirroring `notifySharedGoalReady`, but as the
existing `type: "info"` path (so `sw.js` shows it with **no** Approve/Deny buttons):

```ts
export function recommendationsReadyPayload(setId: string, count: number): InfoPushPayload {
  return {
    type: "info",
    kind: "shared_goal", // reuse the info kind; only `type` + `url` drive UI
    subjectId: setId,
    tag: `recommendations:${setId}`,
    title: "Balance suggestions ready",
    body: count === 1
      ? "1 suggested tuning change is ready to review."
      : `${count} suggested tuning changes are ready to review.`,
    url: `/parent/recommendations/${setId}`,
  };
}
export async function notifyRecommendationsReady(setId: string, count: number): Promise<PushSendResult> {
  /* mirror notifySharedGoalReady */
}
```

In `apps/parent/public/sw.js`: add `const RECOMMENDATIONS = "/parent/recommendations";` and a branch
in `openParent(data)` so a `/recommendations` URL opens the right destination (the existing
`new URL(data?.url || dest, ...)` already honors `data.url`; the branch is for clarity). **Do not**
add `actions` to the info notification and **do not** touch `ApprovalSubjectKind`.

## Step 7 — Parent UI (`apps/parent/src`)

- `pages/RecommendationsPage.tsx` (new): lists sets; a set view renders each change as a card with
  `label`, `currentValue`, `proposedValue` (editable for feature d), `rationale`, and per-change
  buttons **Apply** (b/d) plus set-level buttons **Apply all remaining** (a) and a **Discuss**
  thread (c). Conflicting changes (live value differs from `baselineValue`) show a "changed since
  this suggestion" badge and require an explicit confirm/force.
- Client methods in `apps/parent/src/api.ts` for each endpoint above.
- Route + nav in `apps/parent/src/App.tsx`: add `Route path="/recommendations"` and
  `Route path="/recommendations/:id"`, and a `NavLink to="/recommendations"` labeled
  `Recommendations` that shows an unread count from `GET /api/parent/recommendations`
  (`pendingChanges`). The badge is the source of truth (push is best-effort); refresh it on window
  focus via the existing `App.tsx` focus/visibility probe.
- Share the existing `.main`/`.card`/`.nav` classes; match surrounding page style (see
  `InboxPage.tsx` / `StorePage.tsx`).

## Step 8 — Security & config (`.env`, docker-compose)

- **`.env`** (never committed — already gitignored): add `METRICS_VENICE_API_KEY=` and optionally
  `METRICS_VENICE_DECISION_MODEL=jev-latest`.
- **`.env.example`** and **`.env.production.example`**: add **placeholder** lines only
  (`METRICS_VENICE_API_KEY=`), never real values — alongside the existing `VENICE_API_KEY=` line.
- **Key hygiene:** create a dedicated **INFERENCE**-type key (not ADMIN) with a **consumption
  limit** (USD/DIEM) and, if the deploy host has a fixed egress IP, an **IP allowlist**. Do not
  reuse the image-generation key.
- **`docker-compose.yml`** (and `docker-compose.prod.yml`): pass the var explicitly into the API
  service `environment:` block via interpolation
  (`METRICS_VENICE_API_KEY: ${METRICS_VENICE_API_KEY:-}`), not via `env_file:` of the whole `.env`.
  (Note: the current `api` service does not even forward `VENICE_API_KEY`; follow this
  explicit-interpolation style for the new key.)
- **Read-only data access:** the agent reads only through the API's own read paths (`loadConfig` +
  `adminStats` helpers) inside the process; it is not given a second Postgres role. If it is later
  extracted to a separate container, give it a SELECT-only DB role and a scoped read token — never
  the admin write credentials or the primary `DATABASE_URL`.

## Step 9 — Tests

- Unit (no DB/network): `apps/api/src/tuning.test.ts` — tests of `getPath`/`setPath`,
  `validateTuningValue` (reject `NaN`, negative tier costs, `plotCount` outside `[9,36]`, unknown
  paths), and the three-way merge via a pure helper `planChange({ baseline, current, proposed,
  force })` → `apply | noop | conflict | invalid | skip` (mirroring Phase 5's pure-helper style).
  `balanceDecision.ts`: map a sample Jev payload → `DecisionResult` with a fixture, plus its
  LLM-fallback branch.
- Integration (skipped without `DATABASE_URL`, mirroring `reconciliation.test.ts`):
  - `runBalanceAgent` with the key unset produces **no** rows (`{ created: false }`).
  - Seed a `RecommendationSet` + `TuningChange`s; `applyTuningChanges` calls `saveConfig` once,
    stamps `APPLIED`, and marks the set `RESOLVED`.
  - A change whose live value moved (conflict) is **not** overwritten without `force`.
  - An injected invalid value (`NaN`/negative) is rejected by `validateTuningValue` before write.

## Validation

From `apps/api`:
```
npx prisma generate
npm run build -w @farmhand/api
npm test -w @farmhand/api
npx tsx --test src/tuning.test.ts src/reconciliation.test.ts
```
From the repo root, typecheck the touched frontends and shared:
```
npm run build -w @farmhand/shared
npm run build -w @farmhand/parent
```
Then smoke: with `METRICS_VENICE_API_KEY` set, trigger one run, confirm a `RecommendationSet` +
`TuningChange`s land, a push is sent, `/parent/recommendations/:id` renders, and an apply
round-trips through `saveConfig` with a new `AuditLog` row.

## Definition of done

- `RecommendationSet` + `TuningChange` tables exist (additive migration, zero drift).
- `balanceAgent.ts` schedules a read-only run that reuses `adminStats` helpers and stages 2–4 typed
  deltas; `balanceVenice.ts` resolves models by trait and soft-misses on a missing key;
  `balanceDecision.ts` isolates the Jev mapping with an LLM fallback.
- `tuning.ts` provides `validateTuningValue` + `applyTuningChanges` (three-way merge + clamp +
  single `saveConfig` + audit).
- Parent routes expose list/detail/apply-all/apply-one/discuss/override; the PWA page + nav badge +
  informational push deep-link are wired, with **no** notification-level actions.
- `METRICS_VENICE_API_KEY` is documented in `.env.example`/`.env.production.example` and injected
  explicitly in both compose files; the image-gen key is untouched.
- API + parent + shared build clean and all tests pass, including the tuning integration test
  against a live DB.