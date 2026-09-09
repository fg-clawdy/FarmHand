import assert from "node:assert/strict";
import test from "node:test";
import { assignmentModeForSeed, CHORE_CATALOG, compareClaimsForInbox, compareChoresForKid } from "./choreCatalog.js";
import { choreClaimGate } from "./chores.js";

test("seed catalog has 21 unique slugs", () => {
  assert.equal(CHORE_CATALOG.length, 21);
  const slugs = CHORE_CATALOG.map((row) => row.slug);
  assert.equal(new Set(slugs).size, 21);
});

test("Set Out School Clothes is inactive; dog chores are CRITICAL races", () => {
  const clothes = CHORE_CATALOG.find((row) => row.slug === "set-out-school-clothes");
  assert.equal(clothes?.isActive, false);
  const dogs = CHORE_CATALOG.filter((row) =>
    ["feed-dog-am", "feed-dog-pm", "walk-the-dog"].includes(row.slug),
  );
  assert.equal(dogs.length, 3);
  for (const dog of dogs) {
    assert.equal(dog.priority, "CRITICAL");
    assert.equal(dog.isGlobal, false);
    assert.equal(assignmentModeForSeed(dog), "RACE");
  }
});

test("Brush Your Hair is a photo chore, not a global selfie earn", () => {
  const hair = CHORE_CATALOG.find((row) => row.slug === "brush-your-hair");
  assert.ok(hair);
  assert.equal(hair.requiresSelfie, true);
  assert.equal(hair.requiresApproval, true);
  assert.equal(hair.isGlobal, false);
});

test("Walk the Dog and Easy Bedtime have short descriptions", () => {
  const walk = CHORE_CATALOG.find((row) => row.slug === "walk-the-dog");
  const bed = CHORE_CATALOG.find((row) => row.slug === "easy-bedtime");
  assert.ok((walk?.description ?? "").length > 10);
  assert.ok((bed?.description ?? "").length > 10);
});

test("isGlobal seeds ALL; otherwise RACE", () => {
  assert.equal(assignmentModeForSeed({ isGlobal: true }), "ALL");
  assert.equal(assignmentModeForSeed({ isGlobal: false }), "RACE");
});

test("kid list puts path + CRITICAL first", () => {
  const rows = [
    { title: "Z", includeInPath: false, priority: "NORMAL" as const, sortOrder: 9 },
    { title: "Feed", includeInPath: true, priority: "CRITICAL" as const, sortOrder: 6 },
    { title: "Bed", includeInPath: true, priority: "NORMAL" as const, sortOrder: 1 },
  ];
  const sorted = [...rows].sort(compareChoresForKid);
  assert.equal(sorted[0]?.title, "Feed");
  assert.equal(sorted[1]?.title, "Bed");
});

test("inbox sorts CRITICAL before older NORMAL claims", () => {
  const rows = [
    { priority: "NORMAL" as const, claimedAt: "2026-09-09T10:00:00.000Z" },
    { priority: "CRITICAL" as const, claimedAt: "2026-09-09T12:00:00.000Z" },
  ];
  const sorted = [...rows].sort(compareClaimsForInbox);
  assert.equal(sorted[0]?.priority, "CRITICAL");
});

test("claim gate blocks races, duplicates, weekends, and specific-without-assignment", () => {
  assert.equal(choreClaimGate({
    isActive: true,
    periodEligible: true,
    assignmentMode: "ALL",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: false,
  }).ok, true);
  assert.equal(choreClaimGate({
    isActive: true,
    periodEligible: false,
    assignmentMode: "ALL",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: false,
  }).ok, false);
  assert.equal(choreClaimGate({
    isActive: true,
    periodEligible: true,
    assignmentMode: "ALL",
    hasAssignment: false,
    alreadyClaimedByPlayer: true,
    raceTaken: false,
  }).reason, "You already claimed that chore.");
  assert.equal(choreClaimGate({
    isActive: true,
    periodEligible: true,
    assignmentMode: "RACE",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: true,
  }).reason, "Someone already claimed that chore.");
  assert.equal(choreClaimGate({
    isActive: true,
    periodEligible: true,
    assignmentMode: "SPECIFIC",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: false,
  }).reason, "That chore isn't assigned to you.");
});
