import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_GAME_CONFIG, mergeGameConfig } from "@farmhand/shared";
import { balanceKnobs } from "./adminStats.ts";
import { isEligiblePath } from "./tuning.ts";

test("the admin config save path keeps stars per balloon", () => {
  assert.equal(DEFAULT_GAME_CONFIG.starsPerBalloon, 200);
  assert.equal(mergeGameConfig({}).starsPerBalloon, 200);
  assert.equal(mergeGameConfig({ timezone: "America/Chicago" }).starsPerBalloon, 200);
  const saved = mergeGameConfig({ starsPerBalloon: 250.8 });
  assert.equal(saved.starsPerBalloon, 250);
  assert.equal(balanceKnobs(saved).starsPerBalloon, 250);
  assert.equal(mergeGameConfig({ starsPerBalloon: 3 }).starsPerBalloon, 20);
  assert.equal(mergeGameConfig({ starsPerBalloon: 9000 }).starsPerBalloon, 2000);
  assert.equal(isEligiblePath("starsPerBalloon"), false);
  const page = readFileSync(new URL("../../admin/src/pages/ConfigPage.tsx", import.meta.url), "utf8");
  assert.match(page, /Stars per balloon/);
  assert.match(page, /qa="stars-per-balloon"/);
});
