import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { buildApp } from "./app.js";
import { hashSecret, verifySecret } from "./auth.js";
import {
  DONATE_PIN_REJECTED,
  DONATE_PIN_REQUIRED,
  DONATE_PLAYER_REQUIRED,
  authorizeDonatePin,
  donatePlayerMatchesSession,
  explicitDonatePlayerId,
  pinEnterStep,
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

describe("donate PIN", () => {
  it("lets a no-PIN kid donate with the session alone", async () => {
    let checked = false;
    const decision = await authorizeDonatePin({
      hasPin: false,
      pin: undefined,
      verifyPin: async () => {
        checked = true;
        return false;
      },
    });
    assert.deepEqual(decision, { ok: true });
    assert.equal(checked, false);
  });

  it("rejects a PIN kid with no pin, a bad pin, and accepts the real pin", async () => {
    const hash = await hashSecret("1234");
    const verifyPin = (pin: string) => verifySecret(pin, hash);
    const missing = await authorizeDonatePin({ hasPin: true, pin: undefined, verifyPin });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.statusCode, 401);
      assert.equal(missing.error, DONATE_PIN_REQUIRED);
    }
    const wrong = await authorizeDonatePin({ hasPin: true, pin: "9999", verifyPin });
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.error, DONATE_PIN_REJECTED);
    const right = await authorizeDonatePin({ hasPin: true, pin: "1234", verifyPin });
    assert.deepEqual(right, { ok: true });
  });

  it("does not reuse another kid's PIN after a switch", async () => {
    const willow = await hashSecret("1111");
    const finn = await hashSecret("2222");
    const switched = await authorizeDonatePin({
      hasPin: true,
      pin: "1111",
      verifyPin: (pin) => verifySecret(pin, finn),
    });
    assert.equal(switched.ok, false);
    const willowStill = await authorizeDonatePin({
      hasPin: true,
      pin: "1111",
      verifyPin: (pin) => verifySecret(pin, willow),
    });
    assert.equal(willowStill.ok, true);
    assert.equal(pinEnterStep({
      existingPlayerId: "willow",
      requestedPlayerId: "willow",
      hasPin: true,
      submittedPin: "1111",
    }), "verify");
    assert.equal(pinEnterStep({
      existingPlayerId: "willow",
      requestedPlayerId: "willow",
      hasPin: true,
      submittedPin: undefined,
    }), "skip");
    assert.equal(pinEnterStep({
      existingPlayerId: null,
      requestedPlayerId: "finn",
      hasPin: false,
      submittedPin: undefined,
    }), "establish");
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
