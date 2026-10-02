import assert from "node:assert/strict";
import test from "node:test";
import { jarTraySlots } from "./jarTrayLayout.js";

test("empty tray is one ghost slot inside the board", () => {
  const { slots } = jarTraySlots({ w: 240, h: 300 }, 0, 0);
  assert.equal(slots.length, 1);
  assert.equal(slots[0]?.kind, "ghost");
  const slot = slots[0]!;
  assert.ok(slot.x >= 0 && slot.y >= 0);
  assert.ok(slot.x + slot.w <= 240);
  assert.ok(slot.y + slot.h <= 300);
});

test("three jars plus overflow stay side by side inside the board", () => {
  const board = { w: 260, h: 320 };
  const { slots } = jarTraySlots(board, 3, 2);
  assert.equal(slots.length, 4);
  assert.deepEqual(
    slots.map((slot) => slot.kind),
    ["jar", "jar", "jar", "overflow"],
  );
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    assert.ok(slot.w > 20, "slot wide enough to tap");
    assert.ok(slot.x >= 0 && slot.y >= 0);
    assert.ok(slot.x + slot.w <= board.w + 0.5);
    assert.ok(slot.y + slot.h <= board.h + 0.5);
    const next = slots[i + 1];
    if (next) assert.ok(slot.x + slot.w <= next.x + 0.5, "slots do not overlap");
  }
});
