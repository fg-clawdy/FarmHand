import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { SHARED_GOAL_COPY, type FarmPlayerCard, type PublicPlot, type PublicSharedGoal } from "@farmhand/shared";
import FamilyJarSheet, { jarDonorFromCard } from "../components/FamilyJarSheet.tsx";
import FarmBalloonLayer from "./FarmBalloonLayer.tsx";
import { beginDonation, cardReveal, motionDurations, stepAnim } from "./balloonMotion.ts";
import { planDonation, starsPerFrom } from "./balloonMath.ts";
import { displayFilled, enqueueDonation, type BalloonJob } from "./balloonQueue.ts";

function plot(): PublicPlot {
  return {
    slot: 0,
    state: "empty",
    tier: null,
    plantedAt: null,
    maturesAt: null,
    remainingMs: 0,
    growthStage: null,
    emoji: null,
    face: null,
    ready: false,
  };
}

function card(id: string, name: string, hasPin: boolean): FarmPlayerCard {
  return {
    id,
    name,
    mascot: "cow",
    avatarKind: "mascot",
    avatarPreset: null,
    avatarUrl: null,
    seeds: 4,
    provisionalSeeds: 0,
    points: 800,
    fertilizer: 0,
    seedShards: 0,
    canWater: true,
    plots: [plot()],
    hasPin,
    unlocked: true,
    isActive: true,
  };
}

const players = [card("willow", "Willow", true), card("finn", "Finn", false)];

const jar: PublicSharedGoal = {
  id: "movie",
  title: "Movie night",
  emoji: "🎬",
  targetPoints: 1100,
  filledPoints: 100,
  status: "OPEN",
  tintIndex: 0,
  artUrl: null,
  artStatus: "DEFAULT",
};

function markup(node: ReturnType<typeof createElement>) {
  return renderToString(node)
    .replace(/<!-- -->/g, "")
    .replace(/&#x27;/g, "'");
}

function meadow(goals: { id: string; title: string; cost: number; filled: number }[], starsPer = 200) {
  return markup(
    createElement(FarmBalloonLayer, {
      goals,
      starsPer,
      job: null,
      onOpen: () => undefined,
      onOverflow: () => undefined,
      onFinished: () => undefined,
    }),
  );
}

function run(shown: number, amount: number, starsPer: number) {
  const plan = planDonation(1100, shown, amount, starsPer);
  let state = beginDonation(shown, plan, false, 0);
  const phases = new Set<string>();
  let sawHandoff = false;
  let now = 0;
  for (let i = 0; i < 400 && state.phase !== "rest" && state.phase !== "reward"; i += 1) {
    now += 50;
    state = stepAnim(state, now, false);
    phases.add(state.phase);
    if (state.handoff && state.handoff.t > 0.05 && state.handoff.t < 0.95) sawHandoff = true;
  }
  return { plan, state, phases, sawHandoff };
}

test("tapping a farm bunch asks who is adding stars, then a PIN kid gets the pad", () => {
  const picker = markup(
    createElement(FamilyJarSheet, {
      jar,
      players,
      onClose: () => undefined,
      onUpdated: () => undefined,
    }),
  );
  assert.match(picker, new RegExp(SHARED_GOAL_COPY.whoAdding.replace("?", "\\?")));
  assert.match(picker, /Willow/);
  assert.match(picker, /Finn/);
  assert.doesNotMatch(picker, /data-qa="jar-amounts"/);

  const pin = markup(
    createElement(FamilyJarSheet, {
      jar,
      players,
      sessionPlayer: jarDonorFromCard(players[0]!),
      preview: { availablePoints: 800 },
      onClose: () => undefined,
      onUpdated: () => undefined,
    }),
  );
  assert.match(pin, /Enter your 4-digit PIN/);
  assert.doesNotMatch(pin, /data-qa="jar-amounts"/);
});

test("a confirmed 100 to 350 gift hands off, and a second gift waits on the server total", () => {
  const starsPer = starsPerFrom(200);
  const first: BalloonJob = { goalId: "movie", title: "Movie night", cost: 1100, from: 100, to: 350 };
  const queued = enqueueDonation(
    enqueueDonation([], first),
    { goalId: "movie", title: "Movie night", cost: 1100, from: 350, to: 500 },
  );
  assert.deepEqual(
    queued.map((job) => [job.from, job.to]),
    [
      [100, 350],
      [350, 500],
    ],
  );
  assert.equal(displayFilled("movie", 500, queued, queued[0]!), 100);
  assert.equal(displayFilled("movie", 500, queued.slice(1), queued[1]!), 350);
  assert.equal(displayFilled("movie", 500, [], null), 500);

  const played = run(100, 250, starsPer);
  assert.equal(played.plan.segments[0]?.completes, true);
  assert.equal(played.plan.segments[1]?.fromStars, 0);
  assert.equal(played.plan.segments[1]?.toStars, 150);
  assert.equal(played.sawHandoff, true);
  assert.equal(played.state.phase, "rest");
  assert.equal(Math.round(played.state.shown), 350);
  assert.equal(played.phases.has("zoom-in"), true);
  assert.equal(played.phases.has("zoom-out"), true);

  const done = run(1000, 100, starsPer);
  assert.equal(done.plan.reached, true);
  assert.equal(done.state.phase, "reward");
  assert.equal(cardReveal(done.state, false), 1);
  assert.equal(motionDurations(false).confetti, true);
  assert.equal(done.phases.has("away"), true);
});

test("the meadow shows real goals, an empty lawn, and a +N past three", () => {
  const empty = meadow([]);
  assert.match(empty, /data-goals="0"/);
  assert.doesNotMatch(empty, /data-qa="balloon-flight"/);
  assert.doesNotMatch(empty, /data-qa="balloon-title"/);

  const one = meadow([{ id: "movie", title: "Movie night", cost: 1100, filled: 100 }]);
  assert.match(one, /data-goals="1"/);
  assert.match(one, /Movie night/);
  assert.match(one, /data-qa="open-goal-movie"/);
  assert.doesNotMatch(one, /Willow|Finn|donor/i);

  const three = meadow([
    { id: "movie", title: "Movie night", cost: 1100, filled: 100 },
    { id: "ice", title: "Ice cream", cost: 200, filled: 40 },
    { id: "park", title: "Park day", cost: 1000, filled: 0 },
  ]);
  assert.equal(three.match(/data-qa="balloon-flight"/g)?.length, 3);
  assert.doesNotMatch(three, /data-qa="balloon-more"/);

  const four = meadow([
    { id: "movie", title: "Movie night", cost: 1100, filled: 100 },
    { id: "ice", title: "Ice cream", cost: 200, filled: 40 },
    { id: "park", title: "Park day", cost: 1000, filled: 0 },
    { id: "zoo", title: "Zoo trip", cost: 800, filled: 10 },
  ]);
  assert.equal(four.match(/data-qa="balloon-flight"/g)?.length, 3);
  assert.match(four, /data-qa="balloon-more"/);
  assert.match(four, /\+1/);
  assert.doesNotMatch(four, /Zoo trip/);
});

test("the live farm uses balloons and keeps the balloon QA route out of production", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const farm = readFileSync(new URL("../screens/FarmDashboard.tsx", import.meta.url), "utf8");
  assert.match(app, /import\.meta\.env\.DEV && <Route path="\/qa\/balloons"/);
  assert.match(farm, /LIVE_FARM_GRASS/);
  assert.match(farm, /onDonated/);
  assert.doesNotMatch(farm, /sessionPlayer=/);
  assert.doesNotMatch(farm, /onLibrary/);
  assert.doesNotMatch(farm, /libraryWindow/);
  assert.doesNotMatch(farm, /\.setFamilyJars/);
});
