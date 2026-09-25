import assert from "node:assert/strict";
import test from "node:test";
import { parseParentChoreWrite, slugifyTitle, isGlobalForMode, parseAssignmentMode } from "./parentChoreWrite.ts";
import { buildParentStats, consecutiveApprovalStreak } from "./parentStats.ts";

test("slugify strips punctuation and stays short", () => {
  assert.equal(slugifyTitle("  Feed the Dog!! "), "feed-the-dog");
  assert.equal(slugifyTitle("***"), "chore");
});

test("ALL is global; SPECIFIC and RACE are not", () => {
  assert.equal(isGlobalForMode("ALL"), true);
  assert.equal(isGlobalForMode("RACE"), false);
  assert.equal(isGlobalForMode("SPECIFIC"), false);
});

test("isGlobal true without assignmentMode becomes ALL", () => {
  assert.equal(parseAssignmentMode({ isGlobal: true }), "ALL");
  assert.equal(parseAssignmentMode({ isGlobal: false }), "RACE");
  assert.equal(parseAssignmentMode({ assignmentMode: "SPECIFIC", isGlobal: true }), "SPECIFIC");
});

test("create defaults keep seed-neutral chores parent-friendly", () => {
  const parsed = parseParentChoreWrite({ title: "Fold laundry" }, "create");
  assert.equal(parsed.title, "Fold laundry");
  assert.equal(parsed.emoji, "⭐");
  assert.equal(parsed.assignmentMode, "ALL");
  assert.equal(parsed.requiresApproval, true);
  assert.equal(parsed.isActive, true);
});

test("patch can toggle isActive without touching title", () => {
  const parsed = parseParentChoreWrite({ isActive: true }, "patch");
  assert.equal(parsed.isActive, true);
  assert.equal(parsed.title, undefined);
  assert.equal(parsed.priority, undefined);
});

test("streak skips an empty today and counts yesterday", () => {
  const at = new Date("2026-09-09T17:00:00.000Z");
  const n = consecutiveApprovalStreak(["2026-09-08", "2026-09-07"], "America/Chicago", at, 10);
  assert.equal(n, 2);
});

test("streak is zero after a missed full day", () => {
  const at = new Date("2026-09-09T17:00:00.000Z");
  const n = consecutiveApprovalStreak(["2026-09-07"], "America/Chicago", at, 10);
  assert.equal(n, 0);
});

test("week stats count claims, approvals, denials per kid", () => {
  const at = new Date("2026-09-09T17:00:00.000Z");
  const stats = buildParentStats({
    timezone: "America/Chicago",
    range: "week",
    now: at,
    kids: [
      { id: "willow", name: "Willow", mascot: "cow" },
      { id: "finn", name: "Finn", mascot: "chicken" },
    ],
    claims: [
      {
        playerId: "willow",
        choreId: "bed",
        choreTitle: "Make your bed",
        choreEmoji: "🛏️",
        status: "APPROVED",
        claimedAt: new Date("2026-09-09T12:00:00.000Z"),
        resolvedAt: new Date("2026-09-09T13:00:00.000Z"),
      },
      {
        playerId: "willow",
        choreId: "dog",
        choreTitle: "Walk the Dog",
        choreEmoji: "🐕",
        status: "DENIED",
        claimedAt: new Date("2026-09-08T12:00:00.000Z"),
        resolvedAt: new Date("2026-09-08T13:00:00.000Z"),
      },
      {
        playerId: "finn",
        choreId: "bed",
        choreTitle: "Make your bed",
        choreEmoji: "🛏️",
        status: "PENDING",
        claimedAt: new Date("2026-09-09T14:00:00.000Z"),
        resolvedAt: null,
      },
    ],
  });
  assert.equal(stats.days.length, 7);
  const willow = stats.kids.find((k) => k.id === "willow")!;
  const finn = stats.kids.find((k) => k.id === "finn")!;
  assert.equal(willow.claims, 2);
  assert.equal(willow.approvals, 1);
  assert.equal(willow.denials, 1);
  assert.equal(willow.streak, 1);
  assert.equal(willow.chores[0]?.title, "Make your bed");
  assert.equal(finn.claims, 1);
  assert.equal(finn.approvals, 0);
  assert.equal(finn.series[finn.series.length - 1]?.claims, 1);
});
