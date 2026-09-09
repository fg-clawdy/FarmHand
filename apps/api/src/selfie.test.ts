import assert from "node:assert/strict";
import test from "node:test";
import { decodeSelfiePayload, inspectJpeg, planSelfieReward, SELFIE_MIN_BYTES } from "./selfie.js";

/** Minimal SOF0 JPEG large enough for the quality floor. */
function stubJpeg(width: number, height: number) {
  const sof = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
  ]);
  if (sof.length >= SELFIE_MIN_BYTES) return sof;
  return Buffer.concat([sof, Buffer.alloc(SELFIE_MIN_BYTES - sof.length, 0)]);
}

test("inspectJpeg accepts a sized SOF0 frame", () => {
  const { width, height } = inspectJpeg(stubJpeg(320, 240));
  assert.equal(width, 320);
  assert.equal(height, 240);
});

test("inspectJpeg rejects garbage", () => {
  assert.throws(() => inspectJpeg(Buffer.from("not-a-photo")));
});

test("first selfie of the day grants a seed and unlocks", () => {
  const plan = planSelfieReward({ selfieUnlockDate: null, selfieSeedGrantDate: null }, "2026-09-09");
  assert.equal(plan.grantSeed, true);
  assert.equal(plan.alreadyUnlocked, false);
});

test("second selfie the same Chicago day does not stack seeds", () => {
  const plan = planSelfieReward(
    { selfieUnlockDate: "2026-09-09", selfieSeedGrantDate: "2026-09-09" },
    "2026-09-09",
  );
  assert.equal(plan.grantSeed, false);
  assert.equal(plan.alreadyUnlocked, true);
});

test("a new Chicago day grants again", () => {
  const plan = planSelfieReward(
    { selfieUnlockDate: "2026-09-08", selfieSeedGrantDate: "2026-09-08" },
    "2026-09-09",
  );
  assert.equal(plan.grantSeed, true);
  assert.equal(plan.alreadyUnlocked, false);
});

test("decodeSelfiePayload reads a data URL", () => {
  const jpeg = stubJpeg(80, 80);
  const buf = decodeSelfiePayload(`data:image/jpeg;base64,${jpeg.toString("base64")}`);
  assert.ok(buf.equals(jpeg));
});
