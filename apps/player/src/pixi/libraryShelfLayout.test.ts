import assert from "node:assert/strict";
import test from "node:test";
import type { PublicSharedGoal } from "@farmhand/shared";
import {
  LIBRARY_JAR_CAPACITY,
  familyJarVisible,
  libraryHouseMetrics,
  libraryShelfLayout,
  libraryWindow,
  type LibrarySlot,
} from "./libraryShelfLayout.ts";

const CABINET = { w: 220, h: 280 };

function inside(slot: LibrarySlot, box: { w: number; h: number }) {
  assert.ok(slot.x >= -0.5, "x");
  assert.ok(slot.y >= -0.5, "y");
  assert.ok(slot.x + slot.w <= box.w + 0.5, "right");
  assert.ok(slot.y + slot.h <= box.h + 0.5, "bottom");
  assert.ok(slot.w > 8, "wide enough to tap");
  assert.ok(slot.h > slot.w * 0.8, "stands like a jar");
}

function noOverlap(slots: LibrarySlot[]) {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!;
      const b = slots[j]!;
      const overlap = a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;
      assert.equal(overlap, false, `slots ${i} and ${j} overlap`);
    }
  }
}

function area(slot: LibrarySlot) {
  return slot.w * slot.h;
}

test("zero goals keep both shelves and draw no jars", () => {
  const layout = libraryShelfLayout(CABINET, 0, 0);
  assert.equal(layout.visible, true);
  assert.equal(layout.hero, false);
  assert.equal(layout.shelves.length, 2);
  assert.equal(layout.slots.length, 0);
  for (const shelf of layout.shelves) {
    assert.ok(shelf.w > 40 && shelf.h > 40);
    assert.ok(shelf.x >= 0 && shelf.y >= 0);
    assert.ok(shelf.x + shelf.w <= CABINET.w + 0.5);
    assert.ok(shelf.y + shelf.h <= CABINET.h + 0.5);
  }
  assert.ok(layout.shelves[1]!.y > layout.shelves[0]!.y + layout.shelves[0]!.h);
});

test("one goal is a hero jar larger than a crowded shelf", () => {
  const one = libraryShelfLayout(CABINET, 1, 0);
  const many = libraryShelfLayout(CABINET, 8, 0);
  assert.equal(one.hero, true);
  assert.equal(one.slots.length, 1);
  assert.equal(one.slots[0]?.kind, "jar");
  inside(one.slots[0]!, CABINET);
  assert.ok(area(one.slots[0]!) > area(many.slots[0]!) * 2, "hero is much larger than a packed jar");
  assert.ok(one.slots[0]!.h > CABINET.h * 0.45);
});

test("two open goals are two jars, smaller than the hero, with the box still up", () => {
  const layout = libraryShelfLayout(CABINET, 2, 0);
  assert.equal(layout.visible, true);
  assert.equal(layout.hero, false);
  assert.equal(layout.slots.length, 2);
  assert.ok(layout.slots.every((slot) => slot.kind === "jar"));
  assert.deepEqual(
    layout.slots.map((slot) => slot.shelf),
    [0, 1],
  );
  for (const slot of layout.slots) inside(slot, CABINET);
  noOverlap(layout.slots);
  const hero = libraryShelfLayout(CABINET, 1, 0).slots[0]!;
  for (const slot of layout.slots) {
    assert.ok(area(slot) < area(hero), "two jars scale down from the hero");
  }
});

test("a few goals split across both shelves and stay inside the cabinet", () => {
  const layout = libraryShelfLayout(CABINET, 3, 0);
  assert.equal(layout.hero, false);
  assert.equal(layout.slots.length, 3);
  assert.deepEqual(
    layout.slots.map((slot) => slot.shelf),
    [0, 0, 1],
  );
  assert.ok(layout.slots.every((slot) => slot.kind === "jar"));
  for (const slot of layout.slots) inside(slot, CABINET);
  noOverlap(layout.slots);
  const hero = libraryShelfLayout(CABINET, 1, 0).slots[0]!;
  for (const slot of layout.slots) {
    assert.ok(area(slot) < area(hero), "few jars are smaller than the hero");
  }
});

test("many goals shrink further so every jar still fits", () => {
  const few = libraryShelfLayout(CABINET, 3, 0);
  const many = libraryShelfLayout(CABINET, LIBRARY_JAR_CAPACITY, 0);
  assert.equal(many.slots.length, LIBRARY_JAR_CAPACITY);
  assert.equal(many.hero, false);
  for (const slot of many.slots) inside(slot, CABINET);
  noOverlap(many.slots);
  const fewW = Math.min(...few.slots.map((slot) => slot.w));
  const manyW = Math.max(...many.slots.map((slot) => slot.w));
  assert.ok(manyW < fewW, "more goals means narrower jars");
  const top = many.slots.filter((slot) => slot.shelf === 0).length;
  const bottom = many.slots.filter((slot) => slot.shelf === 1).length;
  assert.equal(top, 4);
  assert.equal(bottom, 4);
});

test("overflow past the shelf cap adds one chip and keeps jars readable", () => {
  const layout = libraryShelfLayout(CABINET, LIBRARY_JAR_CAPACITY, 4);
  assert.equal(layout.slots.length, LIBRARY_JAR_CAPACITY + 1);
  const overflow = layout.slots.filter((slot) => slot.kind === "overflow");
  assert.equal(overflow.length, 1);
  assert.equal(layout.slots.at(-1)?.kind, "overflow");
  for (const slot of layout.slots) inside(slot, CABINET);
  noOverlap(layout.slots);
});

test("house metrics leave an open cabinet inside the post and roof", () => {
  const box = { w: 294, h: 586 };
  const house = libraryHouseMetrics(box);
  assert.ok(house.interior.x > house.body.x);
  assert.ok(house.interior.x + house.interior.w < house.body.x + house.body.w);
  assert.ok(house.interior.y > house.body.y);
  assert.ok(house.interior.y + house.interior.h < house.body.y + house.body.h);
  assert.ok(house.post.y + house.post.h >= box.h - 1, "post reaches the ground");
  assert.ok(house.roof.apexY < house.body.y);
  assert.ok(house.roof.left < house.body.x && house.roof.right > house.body.x + house.body.w);
  const shelves = libraryShelfLayout(house.interior, 0, 0);
  assert.equal(shelves.visible, true);
  assert.equal(shelves.slots.length, 0);
  assert.equal(shelves.shelves.length, 2);
});

test("library window reuses OPEN/READY filtering and the tray cap", () => {
  const jars: PublicSharedGoal[] = Array.from({ length: 10 }, (_, i) => ({
    id: `g${i}`,
    title: `Goal ${i}`,
    emoji: "⭐",
    targetStars: 10,
    filledStars: i,
    status: i === 9 ? "WAITING" : i === 8 ? "READY" : "OPEN",
    tintIndex: i,
    artUrl: null,
    artStatus: "DEFAULT",
  }));
  assert.equal(familyJarVisible(jars[9]), false);
  const windowed = libraryWindow(jars);
  assert.equal(windowed.shown.length, LIBRARY_JAR_CAPACITY);
  assert.equal(windowed.overflow, 1);
  assert.ok(windowed.shown.every((jar) => jar.status === "OPEN" || jar.status === "READY"));
  assert.equal(libraryWindow([]).overflow, 0);
  assert.equal(libraryWindow([]).shown.length, 0);
});
