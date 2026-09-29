import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACE_CENTER_X_TOL,
  FACE_CENTER_Y_TOL,
  MIN_FACE_HEIGHT_FRAC,
  faceBoxInGuide,
} from "./selfieQuality.ts";

describe("faceBoxInGuide", () => {
  it("accepts a centered face that is a bit farther (smaller) in frame", () => {
    const w = 320;
    const h = 240;
    const faceH = Math.ceil(h * 0.08);
    const faceW = Math.ceil(faceH * 0.8);
    const box = { x: (w - faceW) / 2, y: (h - faceH) / 2, width: faceW, height: faceH };
    assert.equal(faceBoxInGuide(box, w, h), true);
  });

  it("rejects faces well outside the loosened center tolerances", () => {
    const w = 320;
    const h = 240;
    const box = { x: 0, y: 0, width: 80, height: 80 };
    assert.equal(faceBoxInGuide(box, w, h), false);
  });

  it("rejects tiny noise boxes below the min face fraction", () => {
    const w = 320;
    const h = 240;
    const faceH = h * (MIN_FACE_HEIGHT_FRAC - 0.01);
    const box = { x: w / 2 - 2, y: h / 2 - faceH / 2, width: 4, height: faceH };
    assert.equal(faceBoxInGuide(box, w, h), false);
  });

  it("keeps loosened tolerances above the old strict center band", () => {
    assert.ok(FACE_CENTER_X_TOL >= 0.28);
    assert.ok(FACE_CENTER_Y_TOL >= 0.32);
    assert.ok(MIN_FACE_HEIGHT_FRAC <= 0.1);
  });
});
