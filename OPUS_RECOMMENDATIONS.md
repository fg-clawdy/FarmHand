# FarmHand — Gameplay, Engagement & Chore-Motivation Recommendations

| | |
|---|---|
| **Repo** | `FarmHand` monorepo @ `cursor/farmhand-monorepo-f3ca` |
| **Companion doc** | `FABLE_ANALYSIS.md` (security/architecture findings, referenced here as `F-###`) |
| **Scope** | Design recommendations only. No production code changed. |
| **North star** | *Kids reliably do their household chores and duties — and keep doing them after the novelty wears off.* Every recommendation below is judged against that, not against "is this a fun game." |

---

## 0. The core design tension you need to name

FarmHand pays kids in stars for chores, and stars convert to real money (`1★ = 1¢`, `packages/shared/src/store.ts:10`) via the store. That is a **tangible, expected, contingent reward** — the exact configuration that motivation research (Deci, Koestner & Ryan's meta-analysis; Lepper's "overjustification" work) associates with *reduced* intrinsic motivation once the reward stops. The household risk is concrete: the kid who used to feed the dog because it's their dog starts asking "how many stars is that?" and then declines at zero.

You can't remove the money — it's the hook that won buy-in. But you can restructure *how* it's delivered. Three levers, all cheap in this codebase:

1. **Shift from per-chore piece-rate toward consistency and completion rewards.** Pay the same total, but weight it toward "you finished your whole morning path" and "you kept a streak" rather than "you did one task." That rewards the *habit*, which is the thing you want to persist.
2. **Make some of the reward unexpected.** Unexpected rewards don't carry the same motivational cost as contracted ones. You already have a near-random surface (ingredients) — extend it.
3. **Let the non-monetary layer carry more weight over time.** Accolades, the garden itself, and parent acknowledgement become the visible "why," with stars quietly in the background.

The garden is the best asset you have and it's currently underused as a motivator. **A garden that visibly reflects real-world consistency is an intrinsic motivator that doesn't decay the way cash does.** Most of what follows leans on that.

---

## 1. Improve gameplay

### 1.1 The economy is flat — restore meaningful choice

Every crop now costs 1 seed, takes 24 h, pays 25★ (`config.ts:8–10, 57–94`). Corn, strawberry and cotton are **mechanically identical**; the only difference is `fertilizerReductionMinutes` (4/6/8 h) and art. The `LEGACY_TIER_ECONOMY` (1/2/3 seeds, 24/48/72 h, 1/2/4★) had real trade-offs and was deliberately flattened.

There's a genuine tension, so let's name it: the flat table is *fair* (no wrong choice, no kid feeling behind), and fairness matters enormously with siblings. But it also means **planting is no longer a decision** — it's a button. `PlantPicker.tsx` offers three options that don't differ.

A middle path that keeps fairness but restores choice:

- **Same expected value, different shape.** Keep every crop at 1 seed / 25★ expected, but vary *time and risk*: corn = 24 h, guaranteed 25★; strawberry = 12 h but pays full only if watered twice (else 15★); cotton = 48 h but pays 25★ + a guaranteed ingredient. No crop is better; they suit different weeks.
- **Make `fertilizerReductionMinutes` legible.** Today the only real differentiator is invisible at plant time. Show "Fertilizer saves 8 h on cotton" in the picker.
- Whatever you pick, record the intent in `balanceGoals` (`config.ts:4–5`) so it survives config edits, and add a shared-package test asserting expected-value parity so a later admin edit can't silently make one crop dominant.

### 1.2 Watering is the daily habit loop — protect and deepen it

`wateringCooldownMinutes: 240`, `wateringMaxPerDay: 3`, `wateringReductionMinutes: 60`, gated behind the daily selfie (`player.ts:289–291`). This is the best-designed loop in the app: a real reason to return, capped so it can't be farmed, tied to a real-world moment.

- **Per-plot watering is tracked but the strategy is trivial.** With 3 waterings and 9 plots, kids just water the three nearest-ready plots. Add a visible payoff for *even care* — a "Well-Tended Garden" bonus if every growing plot was watered at least once this week — so the whole garden matters.
- **Wilting has no teeth and no mercy.** Add a visible "thirsty" warning state before wilt, optionally surfaced to the parent inbox as a nudge. Loss aversion motivates kids strongly, but only the warning makes it feel fair rather than arbitrary.
- **Fix the double-water race (`F-001`)** before tuning any of this, or your telemetry will be wrong.

### 1.3 Give ingredients and mixing a reason to exist

Three ingredients (`moonDew`, `growGoo`, `phoenixAsh`), one claimed per day on a rotation (`nextIngredientIndex`), mixed 3→1 fertilizer (`mixYield: 1`). Functionally this is "collect for three days, get one time-skip" — a chore-shaped mechanic inside a chore app.

- **Make mixing a choice, not a queue.** Different combinations → different outcomes (2 Moon Dew + 1 Ash = "Night Growth," instant 12 h; 3 Grow Goo = double harvest on one plot). Even three recipes turn a rotation into a small puzzle kids will discuss with each other.
- **Tie ingredient drops to chore completion rather than the calendar.** A bonus ingredient for finishing the morning path converts a decorative system into a chore incentive. Highest-leverage change in this section.
- Guard the negative-balance bug (`F-001`) first.

### 1.4 The chore model is strong — surface what it already supports

`Chore` already carries `recurrence`, `timeOfDay`, `priority` (CRITICAL→LOW), `estimatedMinutes`, `requiresSelfie`, `allowsSkip`, `includeInPath`, and `assignmentMode` (ALL / SPECIFIC / **RACE**). That's a rich model, and `RACE` — first sibling to claim wins the slot, enforced by `ChoreRaceSlot` — is genuinely clever.

Underused levers:

- **`priority` appears to carry no economic weight.** CRITICAL and LOW pay the same. Let priority scale the reward, and show that it does — that's how the trash actually gets taken out.
- **`estimatedMinutes` is ideal for an "I have 10 minutes" filter.** A bounded, visible ask beats an open list of fourteen items.
- **`timeOfDay` + `includeInPath` = the morning/evening routine**, the highest-value real-world outcome in the app. Make the path a first-class, completable object (see §3.1).
- **`allowsSkip` deserves a dignified UI.** A kid who can legitimately say "not today" without lying or losing a streak is a kid who keeps using the system honestly.

### 1.5 Close the gameplay gaps that actively hurt the experience

From `FABLE_ANALYSIS.md`, three items are player-facing pain rather than security risk:

- **Purgatory plots (`F-007`)** — a claimed chore occupies a plot that cannot be watered, harvested, or pruned until a parent responds. If the parent forgets, the kid's garden silently dies. This is the most damaging engagement bug in the app: the kid did the work and got punished for the parent's latency. Add an auto-resolve window and/or a kid-side "take it back."
- **Infinite re-claims after deny (`F-008`)** — currently an unbounded loop that spams parents. A cooldown plus a short "here's what to fix" note from the parent turns a rejection into coaching.
- **The double-harvest race (`F-001`)** — beyond the money, an inconsistent garden teaches kids the rules aren't real.

---

## 2. Improve engagement

### 2.1 Accolades are well-built but invisible at the moment of truth

`SEASONAL_TRACKS` (Harvester, Rain Maker, Green Thumb, Smile Season, Crop Explorer, Show-Up) with bronze/silver/gold at 10/50/100, plus `LIFETIME_LEGENDS` (First Harvest, Homestead Helper, Barn Full, Early Bird, Camera Kid). Quarterly seasons via `seasonKeyFromParts`, and `nextStep()` already computes *remaining to next medal* — the precise number that drives goal-gradient behaviour.

The system is better than its presentation:

- **Put "3 more waterings to Silver" on the garden screen**, not behind `AccoladePanel`. The goal-gradient effect only works if the distance is visible while the kid is deciding what to do.
- **Celebrate at the moment of earning.** `AccoladeCelebration.tsx` is 455 bytes — almost certainly a stub. This is the emotional payoff of the entire accolade system; it deserves real production value (animation, sound, a parent-visible notification).
- **Add chore-centric tracks.** Every seasonal track except Show-Up rewards *in-game* actions (harvests, waterings, plantings). The counters exist for `chorePhotos`; add tracks for chores completed, path-completion streaks, and CRITICAL chores done — so the medals celebrate the real-world behaviour, not the farming minigame.
- **Seasonal reset (quarterly) is smart** — it gives kids who joined late or had a bad quarter a genuine fresh start. Make the reset a visible *event* ("Spring Season starts today, medals reset, here's your trophy shelf") rather than a silent rollover.

### 2.2 Build a streak system — carefully

There's no streak concept today (`AccoladeActiveDay` tracks active days but only aggregates). Streaks are the strongest known retention mechanic for habit apps, and habit *is* the goal here.

Do it with guardrails, because a naive streak is cruel to children:

- **Count the real-world behaviour** (chores completed), not app opens. Never reward a kid for opening an app.
- **Ship streak freezes from day one** — 1–2 per month, automatic, no begging. Illness, travel, and a parent's late approval must not break a 40-day streak.
- **Never make a broken streak a loss of stars or garden.** Show it as "best streak: 23 days — start a new one today."
- **Per-chore streaks beat global streaks** for habit formation ("dishes: 12 days"). They isolate the specific duty and make the target concrete.
- Consider making streaks family-visible: siblings seeing each other's streaks is powerful, but see §2.5 on comparison risk.


### 2.3 Make the garden persistent and personal

Right now the garden is a grid of nine plots cycling empty → growing → harvested. Nothing accumulates. A kid who has farmed for six months sees the same screen as one who started yesterday.

Give long-term effort a visible home:

- **A farm that grows with cumulative achievement** — a barn that fills, fences, a pond, decorations unlocked by accolades. Cosmetic-only (no economic power) keeps siblings even while giving the veteran something visible.
- **Let kids spend stars on cosmetics as an alternative to cash-out.** This matters: it creates a *non-monetary* sink for stars, softening the overjustification problem in §0 and teaching saving toward a goal. Some kids will pick the pond over the dollar — let them.
- **A trophy shelf / scrapbook** combining medals with their own selfies is a real keepsake and a reason to return that has nothing to do with rewards.
- **Mascots (cow, chicken, pig, sheep, horse) are identity-only today.** A mascot that reacts to consistency — happy when the path is done, sleepy when neglected — creates gentle attachment. Nudging through a character the kid likes beats nagging and costs nothing emotionally.

### 2.4 Fix the feedback latency between doing and being seen

Today: kid does chore → claims → plot enters purgatory → parent gets push → parent approves → stars arrive. Latency depends entirely on adult availability. For a young child, a reward hours later is barely connected to the act.

- **Acknowledge instantly at claim time** — animation, mascot reaction, "sent to Mom" — so the *doing* is rewarded even while approval is pending (another reason `F-009`, writing the proof photo after commit, matters).
- **Auto-approve low-stakes chores.** `requiresApproval` is already per-chore; encourage parents to disable it for simple, self-evident duties. Trust is itself a motivator and it cuts parent workload.
- **Batch-approve in the parent inbox** with photo thumbnails, making review a 30-second evening ritual rather than an interruption. The faster the parent loop, the tighter the kid's.
- **Push "you got approved" to the kid**, not only to parents — the current push system targets admins exclusively.

### 2.5 Sibling dynamics: cooperation over comparison

`RACE` chores are the existing multiplayer mechanic, and competition does motivate — but a permanent leaderboard between siblings of different ages reliably makes the younger one quit.

- **Prefer shared family goals** — a collective bar ("the family did 50 chores this week → movie night") so the older sibling's success *helps* the younger. Cooperative goals also model household duty as a shared obligation, which is the value you're actually teaching.
- **If you keep leaderboards, rank on personal improvement** ("most improved," "best streak") rather than raw totals.
- **Keep `RACE` for genuinely first-come tasks** and soften the loss (consolation ingredient for the runner-up).
- **Age-scale expectations, not rewards.** A 5-year-old's "make your bed" and a 12-year-old's "clean the kitchen" can both count as full path completions without paying identically.

### 2.6 Session design

`sessionMinutes: 30`, and `Garden.tsx` polls every 5 s (`F-024`). The app is explicitly built for short sessions — good, and rare. Protect it:

- **Resist content that rewards long play.** `balanceGoals` already says this; keep enforcing it in review.
- **A clear "you're done for today" state** is a feature, not a failure. Kids should finish and leave feeling complete.
- **24 h grow times mean one meaningful visit per plot per day.** Healthy pacing — don't let engagement metrics tempt you into shortening it.


---

## 3. Further drive chore and duty encouragement

This is the section that matters most. Everything above serves it.

### 3.1 Make the routine path the hero object

`includeInPath` + `timeOfDay` already model a morning/evening routine, but the path is currently just a filter over a chore list. In real households **the routine is what fails**, not any individual chore — kids don't forget to brush their teeth, they lose the sequence.

- **Represent the path as one completable object** with visible progress ("Morning Path: 3 of 5"), a single celebration at the end, and a reward for the *whole* path rather than per step. This directly implements lever 1 from §0.
- **Weight the economy toward path completion.** If a path is 5 chores, pay noticeably more for all 5 than for 5 separate claims. Partial credit is fine; the completion bonus is the point.
- **Anchor it to a fixed daily cue** (after breakfast, before bed) with a matching reminder (§3.4). Cue-anchoring beats willpower — about as settled as habit research gets.

### 3.2 Move the parent from approver to coach

Parents currently appear almost exclusively as a gate: approve/deny, grant, configure. The parent app is `InboxPage`, `ChoresPage`, `StorePage`, `ActivityPage` — all administrative.

- **Add one-tap encouragement.** A "Nice work!" button or short voice note attached to an approval costs two seconds and is, for most kids under 12, worth more than the stars. Cheapest high-impact feature in this document.
- **Let parents write chore descriptions in their own voice** and show them at claim time. "Remember the corners" beats a generic checklist.
- **Surface wins proactively** — a weekly digest ("Ana kept a 12-day dishes streak") so parents praise specifically rather than generically.
- **Require a reason on deny**, delivered kindly. Unexplained denial reads to a child as arbitrary and is a leading cause of disengagement. Pair with the `F-008` cooldown so denial becomes coaching rather than a retry loop.

### 3.3 Use photos as pride, not surveillance

`requiresSelfie` and proof photos are currently compliance artifacts: evidence for approval, then filed into an Immich folder.

- **Reframe as a before/after scrapbook.** Kids enjoy the messy-room→clean-room pair, and it's the best artifact for showing a child their own competence.
- **Let the kid choose to share a proud photo** to the family view, rather than photos being purely parent-inspected.
- **Be careful with mandatory selfies for older kids** — what reads as fun at 7 reads as distrust at 13. Make `requiresSelfie` age-appropriate per assignment, and honour `F-004`/`F-019` (retention caps, name-free filenames) so the archive stays defensible.

### 3.4 Reminders: the missing habit infrastructure

Push today notifies *parents* about claims. There is no scheduled reminder to the kid — yet "I forgot" is the number one reason household chores don't happen.

- **Scheduled, per-chore, per-kid reminders** tied to `timeOfDay`, delivered to the kid's device.
- **Escalate to the parent only after the kid has had a fair chance** ("Sam's evening path is still open at 8pm") so the app nags the kid, not the parent.
- **Keep reminders few and meaningful.** One well-timed path reminder beats fourteen chore pings; notification fatigue will kill the app faster than any missing feature.
- **Never send guilt.** "Your garden misses you" is dark-pattern design aimed at a child; "Morning path is ready when you are" is not. This line matters — you're building for your own kids.


### 3.5 Rebalance the reward mix

Concretely, against the levers in §0:

- **Reduce per-chore star payout; increase completion and consistency payouts.** Same weekly total, different distribution. Kids optimise for what pays, so make the *pattern* pay.
- **Add occasional unexpected bonuses** — a surprise ingredient, a random "golden chore" worth double, a bonus after an unusually helpful week. Unexpected rewards don't erode intrinsic motivation the way contracted ones do, and they create anticipation.
- **Introduce unpaid duties deliberately.** Some things — clearing your own plate, feeding your own pet — should be expectations, not transactions, and the app should *track* them (streaks, accolades, parent thanks) without paying stars. A chores app where everything has a price teaches that nothing is done for free. An `isPaid: false` flag on `Chore` makes this explicit and is a small schema change.
- **Let stars fund more than cash** — cosmetics (§2.3), privileges (extra screen time, choosing dinner), family experiences. Non-monetary sinks reduce the money framing while keeping the motivation.

### 3.6 Age-appropriate progression

The config is global (`sessionMinutes`, `plotCount`, tiers apply to every player). Real households have a 6-year-old and an 11-year-old with different capacities.

- **Per-player overrides** for the tunables that matter (path size, selfie requirements, reminder cadence, whether approval is needed).
- **Graduated autonomy** — as a kid builds a track record on a chore, reduce oversight automatically (auto-approve after N approvals). The visible loss of supervision *is* the reward, and it's the right real-world lesson: reliability earns trust.
- **Let older kids propose chores** and set their own goals. Ownership beats assignment for adolescents, and the `Chore` model already supports arbitrary entries.

### 3.7 Plan for the day the game stops working

Every extrinsic system decays. Build the exit:

- **Fade the scaffolding deliberately.** As habits solidify, reduce reminders and per-chore payouts for *that specific chore*, keeping the streak and accolade layer. The goal is the kid doing dishes without opening the app.
- **Make "graduated" a celebrated status**, not an absence — a lifetime accolade for a chore done 100 days without a reminder.
- **Expect seasons of disinterest.** Kids churn on everything. The quarterly reset already in the accolade model, plus a low-friction return path, matters more than trying to prevent the lapse.
- **Measure the real outcome, not app metrics.** The question isn't DAU; it's whether the trash goes out. `ActivityLog` and `AccoladeActiveDay` already hold the data — build the parent-facing report that answers it honestly.

---

## 4. Suggested sequencing

**First — repair what's actively harmful.** Gameplay bugs with motivational consequences, already specified in `FABLE_ANALYSIS.md`.
1. Purgatory timeout / kid-side cancel (`F-007`) — kids currently get punished for parent latency.
2. Harvest/water race (`F-001`) — inconsistent rules teach kids the rules aren't real.
3. Deny reason + re-claim cooldown (`F-008`).

**Second — cheap, high-impact motivation work.**
4. Parent one-tap encouragement on approval (§3.2).
5. Instant claim-time acknowledgement to the kid (§2.4).
6. "N more to next medal" on the garden screen (§2.1).
7. A real accolade celebration (`AccoladeCelebration.tsx` is a 455-byte stub).

**Third — the structural motivation shift.**
8. Morning/evening path as a first-class completable object with a completion bonus (§3.1).
9. Kid-facing scheduled reminders (§3.4).
10. Streaks with freezes (§2.2).
11. Reward-mix rebalance toward consistency, plus unpaid duties (§3.5).

**Fourth — depth and longevity.**
12. Persistent farm cosmetics as a non-cash star sink (§2.3).
13. Crop differentiation at equal expected value (§1.1) and recipe-based mixing (§1.3).
14. Per-player config overrides and graduated autonomy (§3.6).
15. Family cooperative goals (§2.5).

---

## 5. What I would not change

- **The 24 h grow cycle and 30-minute sessions.** Short daily touch, no grind. Many commercial kids' apps get this wrong; you got it right.
- **The selfie gate on watering.** It ties an in-game privilege to a real-world moment — genuinely elegant design.
- **The flat crop economy's fairness goal**, even if you add differentiation — keep expected value equal across crops.
- **Parent approval as the default.** It keeps a human in the loop and makes the app a conversation starter rather than a substitute for one.
- **Quarterly accolade seasons.** Fresh starts are kind, and kindness is what keeps kids in the system.

---

## 6. Caveats

These are design recommendations grounded in a read of the code, not in observed play. The most valuable next step isn't on this list: **watch your own kids use it for two weeks and note every moment they hesitate, get confused, or lose interest.** That will beat any amount of static analysis, mine included. Where these recommendations conflict with what you actually observe, trust what you observe.

The motivation claims here reflect mainstream findings from self-determination theory and habit research. They're well-supported in general, but individual children vary enormously and a household of two or three is far too small a sample for population-level effects to hold reliably. Treat the reward-structure advice (§0, §3.5) as the most confident, and the specific mechanics as starting points to test rather than prescriptions.

