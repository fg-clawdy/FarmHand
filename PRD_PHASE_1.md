# FarmHand — Phase 1 PRD

| | |
|---|---|
| **Repo** | `FarmHand` monorepo @ `cursor/farmhand-monorepo-f3ca` |
| **Source docs** | `OPUS_RECOMMENDATIONS.md` (design rationale), `FABLE_ANALYSIS.md` (defects, `F-###`) |
| **Status** | Draft for build. Section numbers in parentheses map to `OPUS_RECOMMENDATIONS.md`. |
| **Guardrails** | Built to respect `OPUS_RECOMMENDATIONS.md` §5 "What I would not change" — see §16 for the compliance check and the one deliberate deviation. |

---

## 0. Scope

**In scope (Phase 1)**

| # | Feature | Source |
|---|---|---|
| F-R1 | Crop differentiation via water gating (cotton / corn / strawberry) | 1.1, 1.2 |
| F-R2 | No double-pay / double-spend anywhere in the economy | 1.5 / `F-001`, `F-006`, `F-014` |
| F-R3 | Deny reason + re-claim cooldown | 1.5 / `F-008` |
| F-R4 | "N more to next medal" on garden + real accolade celebration | 2.1 |
| F-R5 | Purgatory plots stay playable + "remind a grown-up" | 2.4 |
| F-R6 | Family cooperative goals, improvement ranking, soft RACE loss | 2.5 |
| F-R7 | "Done for today" state + completion bonus | 2.6 |
| F-R8 | Routine paths as first-class objects + parent path builder | 3.1 |
| F-R9 | Parent coach tools: encouragement, quick bonus, instant reward | 3.2 |
| F-R10 | Kid-facing reminder banners | 3.4 |
| F-R11 | Per-plant watering cap, not per-child | 1.1 / OQ-2 |

**Explicitly deferred** — Phase 2: ingredient recipes (1.3), chore metadata surfacing (1.4), streaks (2.2), reward-mix rebalance incl. unpaid duties (3.5), age-appropriate progression (3.6). Phase 2/3: persistent farm cosmetics (2.3). Phase 3: scaffolding fade / graduation (3.7). Purgatory auto-timeout (`F-007`) is intentionally **not** being built — in a family the child can remind the parent, which F-R5 makes possible.

---

## 1. F-R1 · Crop differentiation via water gating

### 1.1 Intent

Planting is currently a button: all three crops cost 1 seed, take 24 h, pay 25★. This makes each crop a different *commitment*, priced to match. Cotton is the safe default; corn and strawberry pay more but require the child to come back and water.

### 1.2 Crop specifications

| Crop | Stars | Waters to **start** growing | Waters to **mature** | Behaviour |
|---|---|---|---|---|
| **Cotton** | 25★ | 0 | 0 | Plant and forget. Grows on the 24 h clock immediately. Unchanged from today. |
| **Corn** | 30★ | 1 | 1 (the starter water counts) | Sits dormant after planting; the growth clock does not start until watered once. |
| **Strawberry** | 35★ | 1 | 2 | Dormant until first water. Grows normally, but **will not mature** until a second water is applied. May sit at full growth, harvest-blocked, until watered again. |

Strawberry's 35★ is a proposal, not a given — see §14 OQ-1.

### 1.3 New plot states

`PlotState` (`packages/shared/src/types.ts:15`) gains two members:

- **`dormant`** — planted, growth clock not started, awaiting the first water. Applies to corn and strawberry.
- **`stalled`** — the growth clock has completed but the crop's `watersToMature` requirement is unmet, so the plant is not harvestable. Strawberry only.

`plantedAt` keeps meaning "when the seed went in." A new `growthStartedAt` carries the clock origin.

### 1.4 Growth clock change

`maturityDate()` (`engine.ts:68`) currently computes `plantedAt + durationMinutes − reductions`. It becomes:

```
growthStartedAt === null  →  dormant, no maturity date
otherwise                →  growthStartedAt + durationMinutes − reductions
```

For cotton, `growthStartedAt` is set to `plantedAt` at plant time, so behaviour is identical to today. For corn and strawberry it is `null` until the first water, at which point it is set to the watering timestamp.

**Consequence to accept deliberately:** a dormant corn plant watered 6 hours after planting matures 6 hours later than it would today. That is the intended cost of the higher payout.

### 1.5 Badge and animation rules

Every gate state must be legible on the garden without opening a sheet.

| State | Badge | Rule |
|---|---|---|
| `dormant` (corn, strawberry) | **"Needs water to start"** — persistent, animated pulse on the water affordance | Shows continuously from planting until the first water. There is no cooldown to wait on, so there is no reason to hide it. |
| `growing`, second water outstanding (strawberry) | **"Needs another water to ripen"** | **Hidden while the plant is not waterable.** Appears only once the plant is eligible to be watered again — i.e. the per-plot cooldown has expired *and* the child has waterings left today. |
| `stalled` (strawberry) | **"Ready to ripen — needs water"** — stronger treatment than the growing-state badge | Same eligibility rule: only shown when the plant can actually be watered. When not eligible, show the countdown to the next watering window instead. |

The hide-until-actionable rule is the important one: a badge demanding an action the child cannot take is a nag, not a cue. When a strawberry needs water but the cooldown is still running, the plot shows *when* it can be watered, not *that* it needs watering.

### 1.6 Data model

`Plot` (`schema.prisma:146` area):
- `growthStartedAt DateTime?` — clock origin; `null` means dormant.
- `waterCount Int @default(0)` — waters for this planting, reset on plant/prune/harvest. Distinct from `wateringsCount`, which is a per-day counter and must not be reused for this.

`PlantTier` (`types.ts:30`) and each config tier:
- `watersToStart: number` — 0 for cotton, 1 for corn and strawberry.
- `watersToMature: number` — 0 cotton, 1 corn, 2 strawberry.

`PublicPlot` (`types.ts:72`):
- `watersApplied: number`, `watersToStart: number`, `watersToMature: number`
- `waterGate: "none" | "needs_start_water" | "needs_ripen_water"`
- `gateBadgeVisible: boolean` — the server decides visibility per §1.5 so client and server never disagree.

### 1.7 Config

`DEFAULT_GAME_CONFIG.tiers` (`config.ts:57–94`) updates to:

| tier | kind | points | watersToStart | watersToMature |
|---|---|---|---|---|
| 1 | corn | 30 | 1 | 1 |
| 2 | strawberry | 35 | 1 | 2 |
| 3 | cotton | 25 | 0 | 0 |

`FLAT_TIER_POINTS` (`config.ts:10`) is retired as a single shared constant; per-crop points replace it. `FLAT_TIER_SEED_COST` and `FLAT_TIER_DURATION_MINUTES` remain — cost and base duration stay uniform.

`mergeGameConfig` must clamp both new fields to integers in `[0, 5]` and default them from the shipped tier when absent, so existing compose databases keep working. Note `F-005`: that function currently validates almost nothing, and these fields must not become another unvalidated passthrough.

`isLegacyTierEconomy` (`config.ts:23`) needs a companion check so the boot-merge recognises the *previous flat* table (all crops 1/24h/25★) and replaces it with the new differentiated one — otherwise existing installs stay flat until someone hits Reset.

### 1.8 API behaviour

**`POST /api/plots/:slot/plant`** (`player.ts:196`) — set `growthStartedAt: tier.watersToStart === 0 ? now : null`, `waterCount: 0`.

**`POST /api/plots/:slot/water`** (`player.ts:259`) — several changes:
- The guard at `player.ts:286` rejects watering when `serialized.ready`. It must now permit watering a `stalled` plant, since that is the entire point of the ripen water. Reject only when the plant is genuinely harvestable.
- Increment `waterCount`.
- If `growthStartedAt === null` and `waterCount >= watersToStart`, set `growthStartedAt = now`. **Do not** apply `wateringReductionMinutes` for the starter water — it starts the clock rather than shortening it. Applying both would make corn strictly faster than cotton *and* better paid.
- The ripen water (strawberry's second) **does** apply the normal reduction.
- Daily watering caps and per-plot cooldown are unchanged and still apply.

**`POST /api/plots/:slot/harvest`** (`player.ts:396`) — reject when `waterCount < watersToMature` with "This one needs another water before it's ripe." Must be evaluated inside the locked transaction from F-R2.

### 1.9 Edge cases

- **Dormant plants cannot wilt.** A corn seed never watered is the child deferring, not neglecting. Dormant plots are excluded from any wilt logic.
- **Stalled plants do not wilt** either, for the same reason, and because the child may be out of waters for the day.
- **Fertilizer on a dormant plant** is allowed and banks `fertilizerReductionMinutes`, applied when the clock starts. It does not start the clock.
- **Daily water cap reached on a dormant plant** — acceptable; that plant waits. Per F-R11 the cap is per plant, so other plants are unaffected. The badge hides per §1.5 and the plot shows tomorrow's availability.
- **Config changed mid-growth** (e.g. `watersToMature` lowered) — evaluate against live config at harvest, so a lowered requirement immediately unblocks existing plants. Simpler than snapshotting, and errs toward the child.

### 1.10 Acceptance criteria

1. Cotton planted and left alone matures in 24 h and pays 25★ — identical to current behaviour.
2. Corn planted shows `dormant` with a persistent "needs water to start" badge and a maturity countdown of `null`, not a running clock.
3. Corn watered once transitions to `growing`, `growthStartedAt` set to the water time, no reduction applied for that water.
4. Corn matures 24 h after its first water and pays 30★.
5. Strawberry watered once grows; at clock completion with `waterCount === 1` it enters `stalled` and harvest is rejected.
6. Strawberry watered a second time while stalled becomes harvestable and pays 35★.
7. Strawberry's ripen badge is **absent** while the per-plot cooldown runs or the daily cap is spent, and **present** the moment it becomes waterable.
8. A strawberry stalled overnight with waters available shows the ripen badge on the next session.
9. Dormant and stalled plants never wilt.
10. An existing database with the old flat tier table migrates to the new table on boot without a manual reset.


---

## 2. F-R2 · No double-pay or double-spend anywhere in the economy

### 2.1 Intent

Stars convert to cash at 1★ = 1¢. Every path that mints, holds, spends or adjusts stars must be exactly-once under concurrency, double-tap, retry, and refresh. This is a hard correctness requirement, not a best-effort goal: the audit below covers **every** mutation path found in the codebase, and each must land in a known-good state before Stage 2 begins.

Two distinct bug classes are in scope. **Racing** — concurrent requests both passing a validation gate. **Non-idempotency** — a retried or double-tapped request treated as two separate events because its idempotency key is not derived from a stable identity.

### 2.2 Full audit of star and resource mutation paths

| # | Path | Location | Current state | Required |
|---|---|---|---|---|
| 1 | Harvest → `EARN_HARVEST` | `player.ts:420–446` | **Racing.** Read-validate-write, no lock, default isolation. Key `earn:harvest:${log.id}` is stable, but the log row is created per request, so two races mint two logs and two payouts. | Lock + re-read |
| 2 | Plant → seed decrement | `player.ts:220–237` | **Racing.** | Lock + re-read |
| 3 | Water → reduction + counters | `player.ts:302–318` | **Racing.** | Lock + re-read |
| 4 | Fertilize → `fertilizer` decrement | `player.ts:375` | **Racing.** | Lock + re-read |
| 5 | Ingredient claim | `player.ts:565` | **Racing.** | Lock player row |
| 6 | Ingredient mix → `fertilizer` increment | `player.ts:618` | **Racing.** | Lock player row |
| 7 | Store request → `HOLD_REWARD` | `store.ts:220–268` | **Good.** Serializable + retry, key `hold:${row.id}`. | Keep |
| 8 | Approve → `SPEND_REWARD` | `store.ts:271–300` | **Good.** Status guard + key `spend:${row.id}`. | Keep |
| 9 | Deny → release hold | `store.ts:349` | **Good.** Key `release:${row.id}`. | Keep |
| 10 | Admin grant → `EARN_GRANT` | `store.ts:439–453` | **Broken.** Key is `grant:${playerId}:${Date.now()}:${amount}` (`store.ts:441`). Two clicks in different milliseconds = two keys = **double pay**. Not Serializable, not retried. | Caller UUID + Serializable |
| 11 | Admin adjust → `ADJUST_ADMIN` | `admin.ts:278` | **Broken.** Same `Date.now()` defect. | Caller UUID |
| 12 | Opening balance | `stars.ts:79` | **Good.** Key `opening:${playerId}`. | Keep |
| 13 | Selfie seed grant | `player.ts:161` | Date-guarded; verify under concurrency. | Lock + re-read |
| 14 | Chore approve → plants the crop | `chores.ts:331–381` | **Racing.** Plain `$transaction` — no isolation level, no `FOR UPDATE`. The `status !== "PENDING"` guard at `:338` reads a pre-lock snapshot, so two concurrent approvals (two parents, or one double-tap) both pass and both write the plot. A free extra plant becomes free extra stars at harvest. | Serializable + `FOR UPDATE` on the claim row |
| 15 | Chore deny → closes claim | `chores.ts:384–434` | **Racing.** Same defect; enables approve-after-deny, where a denied claim is still planted. | Serializable + `FOR UPDATE` on the claim row |
| — | Chore claim | `chores.ts:216–316` | **Good.** Serializable + `FOR UPDATE` + retry. The reference implementation. | Keep |

Note that approve/deny mint no stars directly — they plant, and harvest mints. That still counts as double-pay under this section: a duplicate plant is a duplicate future payout, and the guardrail is worthless if it only covers the last hop.

**Adjacent, not fixed here:** `FABLE_ANALYSIS.md` `F-009` notes the proof JPEG is written *after* `claimChore` commits (`player.ts:507–524`) — a disk-write failure leaves a `PENDING` claim with `hasProof: true` but no file, and the `chore_photo` accolade already granted. This does not cause a double-pay by itself, but it means the locked, exactly-once claim this section guarantees can still carry a phantom proof reference. Out of scope for F-R2; flagged so it isn't mistaken for solved by the locking work here.

New paths introduced by this PRD — daily completion bonus (F-R7), path bonus (F-R8), quick bonus and instant reward (F-R9), RACE consolation (F-R6) — must each ship with a stable, derivable idempotency key from day one. **No new key may contain `Date.now()`, `Math.random()`, or a server-side per-request UUID.**

### 2.3 Locking

The codebase already has the correct pattern at `chores.ts:261`: `SELECT id FROM "Plot" WHERE id = ${plot.id} FOR UPDATE` inside a Serializable transaction, with the P2034 retry wrapper `withSerializableRetry` (`store.ts:20–32`).

Extract `withLockedPlot(playerId, slot, fn)`, `withLockedPlayer(playerId, fn)` and `withLockedClaim(claimId, fn)`. All three open a Serializable transaction, take `FOR UPDATE` on the target row, **re-read state after acquiring the lock**, and retry on P2034. Route paths 1–6 and 13–15 through them. Re-reading after the lock is the part that actually fixes the bug — locking while still trusting a pre-lock read accomplishes nothing.

### 2.4 Idempotency key rules

- Keys derive from **stable entity identity**, never wall-clock time.
- Operator-initiated one-shot actions (grant, adjust, instant reward) take a **client-supplied `requestId` UUID**, generated once when the form opens and reused across retries. Replaying the same `requestId` returns the original result and pays nothing further — `appendStarEvent` already handles this via its P2002 catch (`stars.ts:30–34`).
- Periodic awards key on `${kind}:${playerId}:${periodKey}`.
- Entity-derived awards key on the entity id.

### 2.5 Balance integrity

`Player.points` and the ledger are two sources of truth that can drift — that is `F-006`.

- Spend checks use **available** stars — balance minus outstanding `PENDING` holds — via `canAfford` / `starsHeldForPlayer` (`stars.ts:38`). `requestStoreSku` already does this (`store.ts:227–230`); the F-R9 instant reward must too.
- **`POST /admin/players/:id/resources` (`admin.ts:250–288`) must be brought into this guarantee.** Two defects, both `F-006`: (1) it writes `points` directly with a `Math.max(0, Math.floor(...))` clamp that ignores `starsHeldForPlayer` entirely — an operator can set `points` below outstanding holds, so a later approval can drive the ledger inconsistent with what the child can actually redeem; (2) its `ADJUST_ADMIN` idempotency key at `admin.ts:278` is `adjust:${id}:${Date.now()}:${delta}` — the same `Date.now()` defect as path 11 in §2.2, not a separate issue. Fix: refuse (or clamp) any `points` write that would leave `nextPoints < starsHeldForPlayer(id)`, unless holds are explicitly released first; require the caller-supplied `requestId` from §2.4 for the `ADJUST_ADMIN` key.
- Add DB `CHECK (… >= 0)` constraints on `points`, `seeds`, `fertilizer`, `moonDew`, `growGoo`, `phoenixAsh` so no code path can drive a balance negative.
- Add a reconciliation test asserting `Player.points === walletFromLedger(...).currentStars` after every flow, old and new.

### 2.6 Acceptance criteria

1. Two concurrent harvests on one ready plot produce exactly one `EARN_HARVEST` row, one `ActivityLog` harvest row, and one payout.
2. Two concurrent waters consume exactly one watering and apply one reduction.
3. Two concurrent plants on one empty plot consume exactly one seed.
4. Two concurrent mixes with exactly 3 ingredients produce one fertilizer, never a negative balance.
5. Two concurrent fertilize calls with 1 fertilizer in stock consume exactly one.
6. A quick bonus submitted twice with the same `requestId` pays **once**.
7. An admin adjust submitted twice with the same `requestId` applies **once**.
8. Two concurrent store requests that each fit the balance alone but not together: one succeeds, one is refused.
9. An instant reward is refused when available balance (net of holds) is insufficient.
10. A daily completion bonus cannot be paid twice in one day under concurrency.
11. A path bonus cannot be paid twice in one period under concurrency.
12. Balance columns cannot go negative even with application guards removed (constraint test).
13. `Player.points` equals the ledger balance after every flow.
14. A burst of 20 concurrent mixed operations on one plot returns no 500s; conflicts succeed or return a clean 409/400.
15. No idempotency key anywhere in the codebase contains `Date.now()` (grep-based test).
16. Two concurrent approvals of one claim plant exactly one crop and write one `chore_approve` log.
17. Approve and deny racing on one claim: exactly one wins; a denied claim is never planted.
18. `/admin/players/:id/resources` refuses to set `points` below the player's outstanding `PENDING` hold total.
19. `/admin/players/:id/resources` submitted twice with the same `requestId` applies its point delta once.

---

## 3. F-R3 · Deny reason and re-claim cooldown (`F-008`)

### 3.1 Intent

Today a denied chore can be re-claimed immediately and indefinitely, and each claim pushes every parent. Worse, denial carries no explanation — which to a child reads as arbitrary. Turning denial into coaching is the goal; rate-limiting it is the side effect.

### 3.2 Deny reason

`ChoreClaim` has **no** reason field today (only `StoreRedemption.denyReason` exists, `schema.prisma:358`). Add `denyReason String @default("")` to `ChoreClaim`.

- `POST /api/parent/claims/:id/deny` (`parent.ts:231`) accepts `reason`, **required**, minimum 3 characters after trim.
- Offer quick-pick reasons in the parent UI so this stays a two-tap action: "Not finished yet", "Needs another pass", "Wrong chore", "Can't tell from the photo", plus free text.
- The reason shows to the child on the plot/chore card and in the push notification, phrased as a next step rather than a verdict.
- Denying from a push action (`push.ts`) with no reason attached must fall back to a neutral default ("A grown-up asked for another look") rather than blocking the deny. Parents acting from a notification shouldn't be forced into the app.

### 3.3 Re-claim cooldown

- Config knob `choreReclaimCooldownMinutes`, default **30**.
- Config knob `choreMaxClaimsPerPeriod`, default **3** (original claim plus two retries).
- After a deny, the chore is re-claimable by that child only once the cooldown elapses; the card shows "You can try this again at 4:15."
- On hitting the per-period cap, the chore closes for that child for the period with "Ask a grown-up about this one" — deliberately pushing the interaction offline into a conversation.
- Push coalescing: use the existing `approvalTag` (`push.ts:36`) so repeat claims for the same chore replace rather than stack, with a minimum 10-minute interval between pushes for the same chore+child.

### 3.4 Acceptance criteria

1. Deny without a reason is rejected with 400 (except via push action, which applies the default).
2. The child sees the specific reason text on the chore card and in their notification.
3. Re-claim inside the cooldown is rejected and the card shows the retry time.
4. Re-claim after the cooldown succeeds.
5. The fourth claim in a period is refused with the "ask a grown-up" message.
6. Three rapid claims of the same chore produce at most one parent push per 10 minutes.
7. A denied claim still frees the RACE slot as it does today (`chores.ts:403–405`).


---

## 4. F-R4 · Accolade visibility and celebration

Scope confirmed: garden indicator and real celebration only. New chore-centric tracks and the seasonal-reset event are **deferred to Phase 2**; the six existing seasonal tracks are unchanged.

### 4.1 "N more to next medal" on the garden

`nextStep()` (`accolades.ts:185`) already computes exactly the right number, and `AccoladePanel.tsx:42` already renders `"${track.next.remaining} more to ${track.next.medal}"` — but only inside a sheet the child must open. The goal-gradient effect only works when the distance is visible at the moment of deciding what to do.

- Surface **one** track on the garden screen: the closest to its next medal by remaining count. One target, not six.
- Compact treatment: track emoji, "3 more waterings to 🥈", a thin progress bar. Tapping opens the existing `AccoladePanel`.
- Tie-break on the smaller `next.at`, then track order in `SEASONAL_TRACKS`, so the display is stable rather than flickering between equals.
- Suppress when every seasonal track has hit gold; show a quiet "All gold this season 🥇" instead.
- Include the chosen track in the `/api/garden` payload (`player.ts:104`) so the client does no accolade maths.

### 4.2 Real celebration

`AccoladeCelebration.tsx` is a 455-byte stub. This is the payoff for the entire accolade system and the primary non-monetary reward in the app — it deserves real production value.

- Full-screen, medal-appropriate treatment (bronze/silver/gold escalating in intensity), the medal glyph, track title, and an unmissable "what you did" line.
- Sound, respecting a mute preference and the OS reduced-motion setting.
- Queue multiple unlocks and play them in sequence — a harvest can return several `unlocks` at once.
- Dismiss on tap, auto-dismiss after ~6 s, never block a pending game action.
- Lifetime legends (`LIFETIME_LEGENDS`) get a visibly bigger treatment than seasonal medals.
- Notify parents when a child earns a medal, so praise can be specific (feeds F-R9).

### 4.3 Acceptance criteria

1. The garden shows exactly one nearest-medal indicator with a correct remaining count.
2. The indicator updates immediately after a qualifying action.
3. Tapping it opens the badges sheet.
4. Earning a medal plays a full celebration, not a toast.
5. Two medals earned in one harvest play sequentially.
6. Reduced-motion and muted settings are honoured.
7. Gold on every track replaces the indicator with the all-gold state.
8. Parents receive a medal notification.

---

## 5. F-R5 · Purgatory plots stay playable

### 5.1 Intent

A chore claim currently parks a plant in `purgatory` where the child cannot water, fertilize, harvest or prune it (`player.ts:277–279, 357–359, 413–415`). The child did the work and the garden goes dead until a parent responds. Per direction, the fix is not an auto-timeout — it is to make purgatory feel like a normal growing plant that simply cannot *finish* without approval, plus a way for the child to nudge.

### 5.2 Behaviour change

A pending-approval plant grows normally:

- **Watering allowed.** Remove the purgatory rejection in `water` (`player.ts:277–279`). Counts against the daily budget as usual, applies reductions as usual, and satisfies F-R1 water gates as usual.
- **Fertilizing allowed.** Remove the rejection at `player.ts:357–359`.
- **Growth clock runs.** The plant progresses through stages visibly.
- **Harvest still blocked.** The plant may reach full growth and sit in a `pending_approval` mature state, harvestable only once approved.
- **Pruning still blocked** while PENDING — the claim is live and the parent needs the plot's context to review.

This requires `serializePlot` (`engine.ts:98–101`) to stop collapsing purgatory into a stage-1 grey sprout. Pending plants render as real plants with a distinct "waiting for a grown-up" marker, not as a dead stub. The `greyed` flag stays for **denied/wilted** plants only.

### 5.3 "Remind a grown-up"

When a pending plant reaches maturity, the plot shows a **"Tell a grown-up it's ready"** button.

- `POST /api/plots/:slot/remind` — sends a push to all parents.
- Rate limited: one reminder per claim per **6 hours**, config knob `choreReminderCooldownHours`.
- The button only appears once the plant is mature and the claim is still PENDING.

Because this fires roughly 24 hours after the original claim, the notification must be fully self-contained — a parent reading "Approve?" with no context will guess. Required content:
- Child's name
- Chore title
- **Exact date and time the chore was claimed**, formatted in the household timezone ("claimed Tue 3 Mar at 4:12 pm")
- How long it has been pending ("waiting 26 hours")
- Whether a proof photo exists
- Approve / Deny actions inline

The same enrichment applies to the original claim push, since the parent may open either notification late.

### 5.4 Acceptance criteria

1. A plant pending approval can be watered, and the water counts normally.
2. A plant pending approval can be fertilized.
3. Its growth clock advances and stages render normally — no grey stub.
4. Harvest is refused while PENDING with "A grown-up needs to say yes first."
5. Pruning is refused while PENDING.
6. The remind button appears only when pending *and* mature.
7. A reminder push contains name, chore, exact claim date/time in household timezone, pending duration, and photo indicator.
8. A second reminder within 6 hours is refused with the next available time.
9. Approval of a fully grown pending plant makes it immediately harvestable.
10. Denial moves the plant to `wilted` and prune becomes available, as today.

### 5.5 Noted for Phase 2+

Auto-resolve timeouts, child-side claim cancellation, parent-side pending-age dashboards, and escalation after N hours.


---

## 6. F-R6 · Sibling dynamics: cooperation over comparison

### 6.1 Family cooperative goals

A shared, family-wide target so an older sibling's success *helps* the younger rather than beating them.

- Parent-created goal: title, target count, what counts toward it, a reward description, and an optional end date.
- What counts: approved chore claims (default), or a specific chore, or path completions.
- Progress is the **sum across all active children**, displayed as one bar on every child's home screen and in the parent app.
- Reward is described in text and marked complete by a parent — no automatic star payout. Family rewards should be family experiences ("movie night"), not currency.
- Celebrate completion on every child's device simultaneously-ish (next poll), naming every contributor.
- One active goal at a time in Phase 1. Weekly is the expected cadence.
- Contribution counts are visible per child, but presented as "Ana 12 · Sam 9 · together 21" with **together** given the visual emphasis.

The idea deserves tuning once you see it in use — see §14 OQ-3.

### 6.2 Improvement-based ranking

If anything ranks children against each other, it ranks *personal improvement*, never raw totals. A 6-year-old cannot out-chore an 11-year-old, and a leaderboard that says so will make the younger one quit.

- Home screen may show "Most improved this week" based on each child's own prior-week count.
- No raw-total leaderboard anywhere in the child UI.
- Parent stats (`parent.ts:176`) may show absolute numbers — parents need them, children don't.

### 6.3 Soft RACE loss

RACE chores (`assignmentMode: "RACE"`, `ChoreRaceSlot`) are first-come-first-served, so someone always loses. Currently the loser gets a bare "Someone already claimed that chore." (`chores.ts:26`).

- The losing child receives a **consolation ingredient** (one random ingredient), at most once per day, config knob `raceConsolationPerDay` default 1.
- Message names the winner warmly: "Sam got the trash out first — here's a Moon Dew for being quick."
- Only awarded when the child actually attempts the claim and loses; not for chores they never opened.

### 6.4 Acceptance criteria

1. A parent can create a family goal with a target and reward text.
2. Every child's home screen shows the shared bar with combined progress.
3. An approved chore for any child advances the shared bar.
4. Completion celebrates on all children's devices and names contributors.
5. No child-facing view ranks children by raw totals.
6. Losing a RACE grants one consolation ingredient, capped per day, with a message naming the winner.
7. A second RACE loss the same day grants nothing extra and does not error.

---

## 7. F-R7 · "Done for today" state and completion bonus

### 7.1 Intent

A clear finish line is satisfying for the child who reaches it and motivating for the siblings who see it. It also reinforces the short-session design (`sessionMinutes: 30`) rather than encouraging open-ended play.

### 7.2 Definition of "done"

A child is done for today when **all** hold:
- Every chore assigned to them and eligible today is claimed (approved or pending — pending counts; the child's part is finished).
- Today's selfie is taken, if their config requires it.
- Every plot that *can* be actioned has been: no mature unharvested plants, no dormant plants awaiting a starter water, no stalled plants that could be ripened with an available water.

Deliberately **not** required: spending every watering (that would punish thoughtful pacing), planting every empty plot (seeds are finite), or any minimum session length.

If a child has no chores eligible today and nothing actionable, they are done immediately — and that is fine. The app should say so cheerfully rather than inventing busywork.

### 7.3 Presentation

- Prominent home-screen state: "You're done for today! 🎉" with a calm, finished treatment — visually distinct from the busy default.
- Visible on the family/farm view (`FarmDashboard.tsx`) so siblings see who has finished — this is the social encouragement lever.
- Never shame the unfinished. Others show simple progress ("3 of 5 done"), never "not done".
- Shows a short summary of what they did today.

### 7.4 Completion bonus

- Config knob `dailyCompletionBonusStars`, default **5**, admin-adjustable, `0` disables the feature entirely.
- Awarded once per child per day, the first time the done state is reached.
- Ledger: new `StarLedgerKind` value `EARN_DAILY_BONUS`, idempotency key `daily:${playerId}:${dayKey}` — durable and naturally idempotent, unlike the `Date.now()` keys flagged in `F-014`.
- Must be granted inside a locked/serializable transaction (F-R2 helper) to prevent a double award on concurrent requests.
- If a child reaches done, then a parent adds a new chore for today, the child leaves the done state. The bonus is **not** clawed back and **not** re-awarded on reaching done again. The ledger key guarantees this.

### 7.5 Acceptance criteria

1. Done state appears exactly when §7.2 conditions are met.
2. A mature unharvested plant prevents done.
3. A dormant corn plant with waters available prevents done.
4. A stalled strawberry with no waters left does **not** prevent done.
5. A pending-approval chore counts as done for the child's part.
6. Bonus is awarded once, with a `daily:` keyed ledger row.
7. Reaching done twice in a day (after a new chore is added) awards no second bonus.
8. Setting the knob to 0 disables the bonus but keeps the done state.
9. The family view shows finished siblings without shaming the unfinished.
10. Concurrent requests at the moment of completion award exactly one bonus.


---

## 8. F-R8 · Routine paths as first-class objects

### 8.1 Intent

`includeInPath` and `timeOfDay` already exist on `Chore`, but the path is only a filter over a list. In real households the *routine* fails, not the individual chore — kids don't forget to brush their teeth, they lose the sequence. Making the path a single completable object with one bonus at the end is also the primary implementation of the reward-restructuring lever: pay for the pattern, not the piece.

### 8.2 Data model

New `Path` model:
- `id`, `name` ("Morning Path"), `emoji`
- `timeOfDay` — reuses `ChoreTimeOfDay` (MORNING / AFTERNOON / EVENING / ANYTIME)
- `recurrence` — reuses `ChoreRecurrence` (DAILY / WEEKDAYS / WEEKLY / NONE)
- `bonusStars Int` — paid on full completion
- `isActive Boolean`
- `sortOrder Int`

New `PathStep` model: `pathId`, `choreId`, `sortOrder`. A chore may belong to multiple paths.

New `PathAssignment` model: `pathId`, `playerId` — paths are assigned per child, since a 6-year-old's morning is not an 11-year-old's.

New `PathCompletion` model: `pathId`, `playerId`, `periodKey`, `completedAt`, `bonusStars`, with `@@unique([pathId, playerId, periodKey])` for natural idempotency.

The existing `includeInPath` boolean on `Chore` becomes legacy. Migrate existing `includeInPath` chores into a default per-child "Morning Path" grouped by `timeOfDay`, then leave the column in place but unused for one release rather than dropping it immediately.

### 8.3 Child experience

- Path appears on the home screen as one card: name, emoji, **"Morning Path: 3 of 5"**, a progress bar, and the bonus on offer.
- Steps listed in `sortOrder`, each claimable inline — the path is the primary way to claim path chores, though the job board still works.
- Steps show completion state; pending-approval steps count as complete for the child's progress (consistent with F-R5 and F-R7).
- Completing the final step fires **one** path celebration — distinct from and larger than a single chore claim.
- Partial progress is acknowledged without a payout ("3 of 5 — nice start").

### 8.4 Bonus payout

- `bonusStars` defaults to **10** on path creation, parent-editable per path.
- Paid once per path per period, on the transition to all-steps-complete.
- Ledger kind `EARN_PATH_BONUS`, idempotency key `path:${pathId}:${playerId}:${periodKey}`.
- Steps still pay their own chore stars. The path bonus is additive — it makes the full sequence worth more than the sum of its parts, which is the entire point.
- Awarded inside the F-R2 locked transaction.
- Paths whose steps are all pending approval: the bonus is paid when the **child's** part is complete, not on parent approval. The child controls their own completion; the parent controls the chore stars. This is deliberate — making the bonus wait on adult latency would defeat the purpose.

### 8.5 Parent path builder

This must be genuinely easy or paths will never get created. The parent side is the make-or-break surface for this feature.

- New "Paths" section in the parent app, alongside `ChoresPage`.
- Create a path: name, emoji, time of day, recurrence, bonus stars.
- **Drag-to-order step list** with an add-chore picker filtered to active chores; show `estimatedMinutes` per step and a running **total estimated time** for the path, so a parent can see they've built a 45-minute morning for a 7-year-old and reconsider.
- Assign to children with checkboxes; per-child assignment, not global.
- **Duplicate a path** and reassign — the fastest way to make a similar routine for a second child, with steps adjusted.
- **Starter templates** for Morning, After School, and Bedtime, prefilled from the existing chore catalog, so a parent can get to a working path in about three taps.
- Preview showing the path exactly as the child will see it.
- Warn (don't block) when a path has more than 6 steps or exceeds 30 estimated minutes.

### 8.6 API

- `GET/POST /api/parent/paths`, `GET/PATCH/DELETE /api/parent/paths/:id`
- `PUT /api/parent/paths/:id/steps` — full ordered list, replace semantics
- `PUT /api/parent/paths/:id/assignments`
- `POST /api/parent/paths/templates/:template` — instantiate a starter template
- `GET /api/paths` — child's active paths with per-step state and progress

### 8.7 Acceptance criteria

1. A parent can create a path, add ordered steps, and assign it to specific children.
2. The builder shows per-step and total estimated minutes, and warns past 6 steps / 30 minutes.
3. A parent can duplicate a path and reassign it.
4. Starter templates produce a working assigned path.
5. The child's home screen shows the path with accurate "N of M".
6. Claiming a step advances progress immediately.
7. Pending-approval steps count toward the child's progress.
8. Completing all steps fires one path celebration and pays `bonusStars` once.
9. Re-completion in the same period pays nothing further.
10. The bonus is paid on child completion, not parent approval.
11. Existing `includeInPath` chores are migrated into a working default path.
12. Deleting a path does not delete its chores.


---

## 9. F-R9 · Parent coach tools

### 9.1 One-tap encouragement

The cheapest high-impact feature in the whole plan. For most children under 12, a parent's specific "nice work" outweighs the stars.

- On the approve action in the inbox: a row of one-tap praise chips — "Nice work! 👏", "Proud of you ⭐", "That was fast! ⚡", "Best one yet! 🏆" — plus free text.
- Optional short voice note (≤ 15 s) recorded in the parent app, delivered to the child's device. Voice is materially better than text for pre-readers.
- Delivered as a push and shown in the child's app with the parent's name attached.
- Encouragement is never required — approving with no message must stay a single tap. Adding friction to approval would slow the very loop F-R5 is tightening.
- New `Encouragement` model: `claimId?`, `playerId`, `adminId`, `text`, `audioPath?`, `createdAt`.
- Also available unprompted: "Send Ana a note" from the parent kids view, not tied to a claim.
- Reuse the existing JPEG-style validation discipline for audio uploads (type sniffing, size cap, no client-supplied filenames) per `F-004`/`F-019`.

### 9.2 Quick bonus stars

- On any child in the parent app: **+5 / +10 / +25** quick-grant buttons plus a custom amount.
- Requires a short reason, with quick picks: "Went above and beyond", "Helped without asking", "Great attitude", "Extra job".
- The reason is shown to the child with the grant notification — an unexplained bonus teaches nothing.
- Uses `grantEarnedStars` (`store.ts:439`) but **must** replace the `Date.now()` idempotency key (`store.ts:441`, `F-014`) with a client-supplied request UUID, or a double-tapped grant double-pays. Prerequisite, not a nice-to-have.
- Preset amounts are a config knob (`quickBonusPresets`, default `[5, 10, 25]`).
- Every grant writes to `AuditLog` as today.

### 9.3 Instant parent-side reward ("we're at the mall")

The scenario: the family is out, the child wants candy, they have 500★ banked. The parent creates and completes the entire reward in one action from their own phone, with no child device involved.

- **`POST /api/parent/rewards/instant`** with `playerId`, `title`, `emoji`, `starCost`, optional `description`.
- Executes in a single Serializable transaction: create an ad-hoc `StoreSku` (flagged `isAdHoc: true`, `isActive: false` so it never reaches the child's catalog) → create the `StoreRedemption` → hold → approve → redeem. Terminal state `REDEEMED`.
- Ledger: the normal `hold:` then `spend:` pair keyed on the redemption id, so the audit trail is indistinguishable from the standard flow.
- **Rejects when the child lacks the stars**, with their current balance in the error. This must check stars *actually available* — balance minus outstanding holds — or a parent can overspend against a pending request. That is the `F-006` divergence bug, and F-R9 must not add a second way to trigger it.
- UI: pick child → see live available balance → title, emoji, cost → confirm. Recently used ad-hoc rewards are offered as one-tap repeats ("Candy 500★").
- The child sees it in their reward history with the parent's name and receives a notification, so the transaction is visible to them even though they didn't initiate it.
- `StoreSku` gains `isAdHoc Boolean @default(false)`; ad-hoc SKUs are hidden from `listActiveCatalog` (`store.ts:114`) and `listParentSkus` (`store.ts:122`), but retained for history.

### 9.4 Acceptance criteria

1. Approving with a praise chip delivers it to the child with the parent's name.
2. Approving with no message remains one tap.
3. A voice note under the size cap records, uploads, and plays on the child's device.
4. Quick bonus grants stars, requires a reason, and shows that reason to the child.
5. A double-tapped quick bonus grants **once** (UUID idempotency).
6. Instant reward completes create→hold→approve→redeem in one call and lands `REDEEMED`.
7. Instant reward is rejected when available balance (net of holds) is insufficient, and the error states the balance.
8. Instant reward ledger rows match the standard flow's shape.
9. Ad-hoc SKUs never appear in the child's store catalog or the parent's catalog manager.
10. The child sees the instant reward in history with a notification.
11. All three tools write `AuditLog` entries.


---

## 10. F-R10 · Kid-facing reminder banners

### 10.1 Intent

Push today notifies only parents. "I forgot" is the most common reason a household chore doesn't happen, and the app currently does nothing about it for the person who needs the reminder.

### 10.2 In-app banners

- On the child's home screen, a prominent banner for unclaimed eligible chores: **"Have you fed the dog? Claim the task!"** with a direct claim action.
- Rotate through outstanding items rather than stacking banners; one at a time, highest `ChorePriority` first (CRITICAL first).
- Surface on an otherwise-idle dashboard — when the child has nothing else demanding attention, this is the highest-value thing to show.
- Suppress entirely in the done state (F-R7). A child who has finished must never be nagged.
- Path-aware: if the chore belongs to an incomplete path, the banner promotes the path ("2 left in your Morning Path") rather than the single chore, so the routine stays the unit.

### 10.3 Scheduled push to children

- Per-path and per-chore reminder times derived from `timeOfDay`, with config defaults per slot (MORNING 07:30, AFTERNOON 15:30, EVENING 19:00), overridable per path.
- Requires child-device push subscriptions. `PushSubscription` is `adminId`-only today, so it needs a nullable `playerId` and a subject discriminator, plus subscription UI in the player app.
- **Maximum two scheduled reminders per child per day.** One well-timed path reminder beats fourteen chore pings; notification fatigue will kill this feature faster than its absence would.
- Skipped entirely when the child is already done, or when the relevant path is already complete.

### 10.4 Escalation to parents

- The app nags the child first, the parent second.
- If a path is still incomplete N minutes after its reminder (config `pathEscalationMinutes`, default 90), notify parents: "Sam's evening path is still open."
- Once per path per period. Informational, no approve/deny action.

### 10.5 Copy rules — non-negotiable

Reminder copy must never use guilt, loss framing, or emotional pressure aimed at a child.

- **Allowed:** "Morning path is ready when you are", "Have you fed the dog? Claim the task!", "2 left in your Morning Path"
- **Forbidden:** "Your garden misses you", "Your plants are sad", "Don't lose your progress", anything implying a character is disappointed, and any countdown pressure on a chore.
- All reminder strings live in one module so they can be reviewed in one place. Add a test that fails on a denylist of guilt words ("miss", "sad", "disappointed", "lose", "lonely") appearing in reminder copy.

### 10.6 Acceptance criteria

1. An unclaimed eligible chore shows a banner with a working claim action.
2. Only one banner shows at a time, highest priority first.
3. A chore in an incomplete path promotes the path instead.
4. Banners disappear in the done state.
5. A child device can subscribe to push and receive a scheduled reminder.
6. No more than two scheduled reminders per child per day.
7. No reminder is sent when the child is done or the path is complete.
8. Parent escalation fires once per path per period, after the configured delay.
9. The copy denylist test passes.


---
---

## 11. F-R11 · Per-plant watering cap, not per-child

### 11.1 Intent

Watering limits should constrain *each plant*, not the child's total activity. A child with 9 corn planted should be able to water all 9, three times each — 27 waterings a day — while no single plant can absorb more than 3. The cap exists to stop one plant being rushed to maturity, not to ration how much gardening a child may do.

### 11.2 Current behaviour — mostly already correct

Good news: the enforcement is already per-plant. `plotWateringState` (`game.ts:54–77`) reads `plot.wateringsOnDate` / `plot.wateringsCount` — **the plot's own counters** — and computes `wateringsLeft = wateringMaxPerDay - used` against that plot. The water handler validates against that per-plot state (`player.ts:292–301`) and increments the plot's counter (`player.ts:307–308`). The comment at `game.ts:53` already describes the intent: *"Per-plant 4h / 3-per-Chicago-day caps."*

So the 27-waterings case likely already works. What is broken is everything *around* it:

**Problem 1 — the player-level counters are still written.** `player.ts:311–318` maintains `Player.wateringsOnDate` / `Player.wateringsCount`, incrementing a per-child daily total on every water. Nothing enforces against these for players with plots, but they are a live per-child counter sitting in the schema, and the `wateringState` fallback at `game.ts:134–143` *does* enforce against them when `plots.length === 0`. That fallback is dead in practice (plots are synced by `syncPlayerPlots`) but it is a per-child cap that will bite if it ever becomes reachable.

**Problem 2 — the aggregate is incoherent.** `wateringState` (`game.ts:105–133`) sums `wateringsUsed` across all plots, then reports `wateringsLeft` as the **max** across plots (`game.ts:126`). So a child with 9 plants might see "used 14, 3 left" — a total that means nothing, paired with a remaining count from whichever single plant happens to be freshest. The garden UI consumes this (`Garden.tsx:215–216`) to compute a global `canWater`, which is why the limit *feels* per-child even though enforcement is per-plant.

**Problem 3 — a global cooldown in the UI.** `Garden.tsx:216` gates watering on `player.water.cooldownRemainingMs === 0`, a single garden-wide cooldown derived from the min across plots (`game.ts:128`). A child who waters plot 1 may see the whole garden appear to go on cooldown.

### 11.3 Required changes

- **Enforcement stays per-plant.** `plotWateringState` is correct; do not change its semantics. Both the 4 h cooldown (`wateringCooldownMinutes`) and the 3/day cap (`wateringMaxPerDay`) apply per plot.
- **Remove the per-child cap entirely.** Delete the `plots.length === 0` fallback branch (`game.ts:134–143`). Stop writing `Player.wateringsOnDate` / `Player.wateringsCount` in the water handler (`player.ts:311–318`); keep `Player.lastWateredAt` only if something else needs it, otherwise drop that write too. Mark the two `Player` columns deprecated and remove them in a follow-up migration once nothing reads them.
- **Fix the aggregate.** `wateringState` should stop reporting a meaningless summed `wateringsUsed` and a max-based `wateringsLeft`. It reports only what a garden-level summary can honestly say: `anyPlantCanBeWatered` (already computed as `anyCan`), and optionally `plantsWaterableNow` as a count. Per-plant numbers stay on each plot, where `publicPlayer` already puts them (`game.ts:238–239`).
- **Fix the UI gate.** `Garden.tsx` must not apply a global cooldown. The water tool is enabled whenever the selfie is unlocked and at least one plant is waterable; per-plot eligibility already arrives as `plot.canWater` and drives glow via `glowingSlots`. `PlotSheet.tsx:57` already gates its button on `plot.canWater`, which is correct.
- **Config naming.** `wateringMaxPerDay` is ambiguous now that the distinction matters. Rename to `wateringMaxPerPlantPerDay` with a back-compat read of the old key in `mergeGameConfig`, and update the tunables label in the admin UI to say "per plant, per day."
- **Selfie gate unchanged.** One selfie still unlocks watering for the day, for all plants. That guardrail stays exactly as it is.

### 11.4 Effect on OQ-2

This resolves OQ-2. The starter-water concern — that planting three corn would consume a whole day's water budget — was based on a per-child reading of `wateringMaxPerDay`. With the cap correctly per-plant, a child can plant 9 corn and start all 9 the same day. No starter-water exemption is needed, and the daily cap creates no planning constraint on how many plants a child may tend.

The only remaining constraint is the per-plant 4 h cooldown, which is the intended one: it stops a single plant being rushed from seed to harvest in an afternoon.

### 11.5 Acceptance criteria

1. A child with 9 planted plots can water all 9 in one day — 27 waterings total.
2. A single plant refuses a 4th water on the same Chicago day.
3. A single plant refuses a 2nd water inside the 4 h cooldown.
4. Watering plot 1 leaves plots 2–9 immediately waterable in both API state and UI.
5. No per-child daily watering total is enforced anywhere.
6. A child with 0 plots hits no legacy per-child cap (fallback branch removed).
7. Per-plant counters reset correctly on a new day in the configured timezone.
8. The garden summary exposes no summed `wateringsUsed` or max-based `wateringsLeft`.
9. The existing `gameService.test.ts` per-plant cases (`:27`, `:43`, `:58`) still pass unchanged.
10. A config using the old `wateringMaxPerDay` key still loads, mapped to the new name.
11. Starting 9 dormant corn plants (F-R1) in one day is possible without exhausting any budget.



## 12. Data model summary

**New models:** `Path`, `PathStep`, `PathAssignment`, `PathCompletion`, `Encouragement`, `FamilyGoal`, `FamilyGoalProgress`

**Modified:**

| Model | Change |
|---|---|
| `Plot` | `growthStartedAt DateTime?`, `waterCount Int @default(0)` |
| `ChoreClaim` | `denyReason String @default("")`, `claimCountInPeriod Int @default(1)` |
| `StoreSku` | `isAdHoc Boolean @default(false)` |
| `PushSubscription` | nullable `playerId` + subject discriminator, `adminId` becomes nullable |
| `Player` | `dailyBonusDate String?` (guard alongside the ledger key); `wateringsOnDate` / `wateringsCount` **deprecated** by F-R11 — stop writing, drop in a follow-up migration |
| `StarLedgerKind` | new values `EARN_DAILY_BONUS`, `EARN_PATH_BONUS`, `EARN_BONUS_GRANT` |
| `PlotState` | new values `dormant`, `stalled` |

**Config additions:** per-tier `watersToStart` / `watersToMature`; `choreReclaimCooldownMinutes` (30), `choreMaxClaimsPerPeriod` (3), `choreReminderCooldownHours` (6), `dailyCompletionBonusStars` (5), `quickBonusPresets` ([5,10,25]), `raceConsolationPerDay` (1), `pathEscalationMinutes` (90), `reminderTimes` per `timeOfDay`.

**Config renames:** `wateringMaxPerDay` → `wateringMaxPerPlantPerDay` (F-R11), with back-compat read of the old key.

**Constraints added:** `CHECK (… >= 0)` on `Player.points`, `seeds`, `fertilizer`, `moonDew`, `growGoo`, `phoenixAsh` (F-R2).

Every new knob must be validated in `mergeGameConfig` — integers, bounded, sane fallbacks. `F-005` documents that this function currently validates almost nothing; do not extend that pattern.

---

## 13. Build sequence

**Stage 1 — foundation (blocking).**
1. F-R2 `withLockedPlot` / `withLockedPlayer` + paths 1–6 and 13 + CHECK constraints.
2. F-R2 `Date.now()` key replacement on grant (`store.ts:441`) and adjust (`admin.ts:278`) — prerequisite for F-R9.2.
3. F-R2 available-balance and ledger-reconciliation tests.
4. `mergeGameConfig` validation for all new knobs.

**Stage 2 — crops and plots.**
5. F-R11 per-plant cap cleanup (remove per-child remnants, fix aggregate and UI gate, rename knob). Do this **before** F-R1, so crop gating is built on correct watering semantics.
6. F-R1 crop differentiation (schema, engine, config migration, badges).
7. F-R5 purgatory playability + remind button + enriched notifications.

**Stage 3 — routine and motivation core.**
8. F-R8 paths (model, child UI, parent builder, bonus).
9. F-R7 done state + completion bonus (depends on paths for its definition of done).
10. F-R3 deny reason + cooldown.

**Stage 4 — parent and feedback surfaces.**
11. F-R9 coach tools.
12. F-R4 accolade indicator + celebration.
13. F-R10 reminder banners, then child push, then escalation.
14. F-R6 family goals, improvement ranking, RACE consolation.

Stage 1 must land before anything else touches the economy. F-R11 precedes F-R1. F-R7 depends on F-R8. F-R10's path-aware banners depend on F-R8. F-R9.2 and F-R9.3 depend on the Stage 1 idempotency and available-balance fixes.

---

## 14. Test requirements

- **Shared package** (`packages/shared`, currently 46/46 passing): unit tests for the new `maturityDate` clock behaviour, dormant/stalled state derivation, badge visibility rules, path completion evaluation, and done-state evaluation. Keep the suite green.
- **Concurrency**: integration tests for all 15 F-R2 acceptance criteria. This is the largest single test block in Phase 1 and is not optional — every row in the §2.2 audit table needs a corresponding test.
- **Idempotency**: replay tests for every operator action (grant, adjust, instant reward), asserting a repeated `requestId` is a no-op. Plus the grep test that no idempotency key contains `Date.now()`.
- **Economy invariants**: a test asserting `Player.points` equals `walletFromLedger(...).currentStars` after each flow, old and new. This is the `F-006` guard.
- **Watering**: per-plant cap tests from F-R11 §11.5, including the 9-plots/27-waterings case and the "watering one plot does not gate the others" case. Existing `gameService.test.ts` cases must pass unchanged.
- **Migration**: tests that an old flat-tier config row boots into the new differentiated table, that `includeInPath` chores migrate into a working path, and that a config using `wateringMaxPerDay` still loads under the new name.
- **Copy**: the reminder-copy denylist test from §10.5.
- **Before starting**, run `npm ci` at the root — `apps/api`'s `push.test.ts` currently fails on a missing local `web-push` install (`F-021`), a stale `node_modules` rather than a repo defect.


---

## 15. Open questions

- **OQ-1 · Strawberry payout.** 35★ is proposed against cotton's 25★ for two waters plus a maturity gate. If it proves too generous, drop to 32★; if nobody plants it, the gate is the friction rather than the price. Worth a week of observation before tuning.
- **OQ-2 · ~~Corn's starter water vs the daily cap~~ — RESOLVED by F-R11.** The concern assumed `wateringMaxPerDay` was a per-child budget. It is enforced per plant (`game.ts:64`), and F-R11 removes the per-child remnants and the misleading aggregate. A child can start 9 corn in one day. No starter-water exemption needed.
- **OQ-3 · Family goal tuning.** Target size, cadence, and whether progress should be weighted by age. Ships with one weekly goal and unweighted counts; revisit with real numbers.
- **OQ-4 · Done-state strictness.** §7.2 requires all actionable plots to be handled. If that proves too strict — a child deliberately saving a harvest for tomorrow can never finish — relax to chores and selfie only.
- **OQ-5 · Voice note storage.** Audio in the Immich-watched selfie directory is probably wrong. Recommend a separate directory with its own retention policy.

---

## 16. Out of scope

Ingredient recipes (1.3), chore metadata surfacing (1.4), streaks (2.2), persistent farm cosmetics (2.3), reward-mix rebalance and unpaid duties (3.5), age-appropriate progression (3.6), scaffolding fade and graduation (3.7). Purgatory auto-timeout (`F-007`) is declined by design. Security findings from `FABLE_ANALYSIS.md` are tracked separately, except `F-001`, `F-005`, `F-006` and `F-014`, which are pulled in here because this PRD's features would otherwise compound them.

---

## 17. §5 guardrail compliance

`OPUS_RECOMMENDATIONS.md` §5 listed five things not to change. Checking this PRD against each:

| Guardrail | Status |
|---|---|
| 24 h grow cycle, 30-minute sessions | **Kept.** `FLAT_TIER_DURATION_MINUTES` and `sessionMinutes` unchanged. The done state (F-R7) actively reinforces short sessions, and F-R10 caps reminders at two per day. |
| Selfie gate on watering | **Kept and strengthened.** Water gating (F-R1) makes the selfie-gated action more central, since corn and strawberry now depend on it. |
| Flat crop economy's fairness goal | **Deliberate deviation — see below.** |
| Parent approval as the default | **Kept.** `requiresApproval` untouched; F-R5 makes waiting less punishing rather than removing the gate; F-R9 enriches the approval moment. No auto-approval is introduced. |
| Quarterly accolade seasons | **Kept.** Season logic untouched; the reset event is deferred to Phase 2. |

**On the fairness deviation.** §5 recommended keeping expected value equal across crops. This PRD sets different payouts (25/30/35★) at your direction. The justification holds: the extra stars buy *effort and attention*, not luck, so a child who waters earns more while a child who doesn't can still take cotton's guaranteed 25★ at zero risk. Fairness survives in the sense that matters — no child is locked out of a good outcome, and the safe option stays genuinely viable.

An earlier draft flagged a residual risk that younger children with less device access might systematically under-earn. **That concern is withdrawn at your direction:** younger kids can get help from older siblings, and a younger child asking an older one to help water is cooperation, not a fairness defect — it pushes in the same direction as F-R6. No mitigation is specified and no per-child earnings monitoring is required in Phase 1.

