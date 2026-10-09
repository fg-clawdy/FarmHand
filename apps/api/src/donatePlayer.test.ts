import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { buildApp } from "./app.js";
import {
  DONATE_PLAYER_REQUIRED,
  donatePlayerMatchesSession,
  explicitDonatePlayerId,
} from "./donatePlayer.js";
import { pourSharedGoal } from "./sharedGoals.js";

describe("donate player id", () => {
  it("rejects a missing donor and does not fall back to a session kid", () => {
    const leftoverGardenKid = "willow";
    assert.equal(explicitDonatePlayerId(undefined), null);
    assert.equal(explicitDonatePlayerId(null), null);
    assert.equal(explicitDonatePlayerId(""), null);
    assert.equal(explicitDonatePlayerId("   "), null);
    assert.equal(explicitDonatePlayerId(1), null);
    assert.equal(explicitDonatePlayerId(leftoverGardenKid), leftoverGardenKid);
    assert.notEqual(explicitDonatePlayerId(undefined), leftoverGardenKid);
    assert.equal(donatePlayerMatchesSession("finn", leftoverGardenKid), false);
    assert.equal(donatePlayerMatchesSession(leftoverGardenKid, leftoverGardenKid), true);
  });

  it("pour refuses an empty player id before touching a wallet", async () => {
    await assert.rejects(
      () => pourSharedGoal({ playerId: "", goalId: "goal", amount: 5, requestId: "req" }),
      (err: unknown) => {
        const error = err as Error & { statusCode?: number };
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, DONATE_PLAYER_REQUIRED);
        return true;
      },
    );
  });
});

describe("POST /api/shared-goal/give", () => {
  const appPromise = buildApp();

  after(async () => {
    const app = await appPromise;
    await app.close();
  });

  it("rejects a donate with no explicit player even if a garden cookie is present", async () => {
    const app = await appPromise;
    const res = await app.inject({
      method: "POST",
      url: "/api/shared-goal/give",
      headers: {
        "content-type": "application/json",
        cookie: "fh_player=leftover-garden-session",
      },
      payload: { goalId: "goal", amount: 5, requestId: "req" },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, DONATE_PLAYER_REQUIRED);
  });

  it("rejects a blank player id", async () => {
    const app = await appPromise;
    const res = await app.inject({
      method: "POST",
      url: "/api/shared-goal/give",
      headers: { "content-type": "application/json" },
      payload: { playerId: "   ", goalId: "goal", amount: 5, requestId: "req" },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, DONATE_PLAYER_REQUIRED);
  });
});
