import assert from "node:assert/strict";
import test from "node:test";
import {
  CHORE_HEAT_SCORE_BOOST_MAX,
  choreClockParts,
  choreSuggestSectionTitle,
  currentChoreTimeOfDay,
  partitionEligibleChoresForNow,
  scoreChoreForNow,
} from "./choreSuggest.js";

test("currentChoreTimeOfDay maps school-day hours", () => {
  assert.equal(currentChoreTimeOfDay(8), "MORNING");
  assert.equal(currentChoreTimeOfDay(15), "AFTERNOON");
  assert.equal(currentChoreTimeOfDay(19), "EVENING");
  assert.equal(currentChoreTimeOfDay(23), "EVENING");
});

test("weekday 8am prefers morning CRITICAL over evening", () => {
  const clock = { hour: 8, weekday: 2 }; // Tue
  const morning = scoreChoreForNow(
    { timeOfDay: "MORNING", recurrence: "DAILY", priority: "CRITICAL", includeInPath: true },
    clock,
  );
  const evening = scoreChoreForNow(
    { timeOfDay: "EVENING", recurrence: "DAILY", priority: "CRITICAL", includeInPath: true },
    clock,
  );
  assert.ok(morning > evening);
});

test("WEEKDAYS chore demoted on Saturday", () => {
  const chore = {
    timeOfDay: "MORNING",
    recurrence: "WEEKDAYS",
    priority: "NORMAL",
    includeInPath: true,
  };
  const sat = scoreChoreForNow(chore, { hour: 8, weekday: 6 });
  const tue = scoreChoreForNow(chore, { hour: 8, weekday: 2 });
  assert.ok(tue > sat);
});

test("heat boost is capped and secondary to tags", () => {
  const clock = { hour: 8, weekday: 2 };
  const coldPerfect = scoreChoreForNow(
    { id: "a", timeOfDay: "MORNING", recurrence: "DAILY", priority: "NORMAL", includeInPath: true, heatScore: 0 },
    clock,
  );
  const hotWrong = scoreChoreForNow(
    { id: "b", timeOfDay: "EVENING", recurrence: "DAILY", priority: "NORMAL", includeInPath: true, heatScore: 100 },
    clock,
  );
  assert.ok(coldPerfect > hotWrong, "cold in-window beats hot wrong-window");

  const base = scoreChoreForNow(
    { id: "c", timeOfDay: "MORNING", recurrence: "DAILY", priority: "NORMAL", includeInPath: true },
    clock,
  );
  const withMap = scoreChoreForNow(
    { id: "c", timeOfDay: "MORNING", recurrence: "DAILY", priority: "NORMAL", includeInPath: true },
    clock,
    { c: 100 },
  );
  assert.ok(Math.abs(withMap - base - CHORE_HEAT_SCORE_BOOST_MAX) < 1e-9);
});

test("partitionEligibleChoresForNow keeps Right now small", () => {
  const chores = [
    {
      id: "1",
      title: "Feed Dog A.M.",
      timeOfDay: "MORNING",
      recurrence: "DAILY",
      priority: "CRITICAL",
      includeInPath: true,
      eligible: true,
    },
    {
      id: "2",
      title: "Brush Teeth A.M.",
      timeOfDay: "MORNING",
      recurrence: "DAILY",
      priority: "NORMAL",
      includeInPath: true,
      eligible: true,
    },
    {
      id: "3",
      title: "Make bed",
      timeOfDay: "MORNING",
      recurrence: "DAILY",
      priority: "NORMAL",
      includeInPath: true,
      eligible: true,
    },
    {
      id: "4",
      title: "Walk dog",
      timeOfDay: "AFTERNOON",
      recurrence: "DAILY",
      priority: "CRITICAL",
      includeInPath: true,
      eligible: true,
    },
    {
      id: "5",
      title: "Easy Bedtime",
      timeOfDay: "EVENING",
      recurrence: "DAILY",
      priority: "NORMAL",
      includeInPath: true,
      eligible: true,
      heatScore: 100,
    },
    {
      id: "6",
      title: "Done chore",
      timeOfDay: "MORNING",
      recurrence: "DAILY",
      priority: "NORMAL",
      includeInPath: true,
      eligible: false,
    },
  ];
  // Tuesday 8am Chicago: 2026-09-22 13:00 UTC = 8:00 CDT.
  const now = new Date("2026-09-22T13:00:00.000Z");
  const part = partitionEligibleChoresForNow(chores, {
    now,
    timeZone: "America/Chicago",
    maxSuggested: 4,
  });
  assert.equal(part.window, "MORNING");
  assert.match(part.sectionTitle, /School morning/);
  assert.ok(part.suggested.length <= 4);
  assert.ok(part.suggested.some((c) => c.id === "1"));
  assert.ok(!part.suggested.some((c) => c.id === "6"));
  assert.ok(part.more.every((c) => c.eligible));
  // Evening chore should not dominate the morning strip even with max heat.
  assert.ok(!part.suggested.some((c) => c.id === "5") || part.suggested[0]?.id !== "5");
});

test("choreClockParts reads America/Chicago", () => {
  const clock = choreClockParts(new Date("2026-09-22T13:00:00.000Z"), "America/Chicago");
  assert.equal(clock.hour, 8);
  assert.equal(clock.weekday, 2);
  assert.match(choreSuggestSectionTitle(clock), /School morning/);
});
