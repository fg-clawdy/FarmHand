const fs = require("fs");

// choreSkip.ts — reject RACE
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/packages/shared/src/choreSkip.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("assignmentMode === \"RACE\"")) {
    s = s.replace(
      `if (!opts.allowsSkip) {
    return { ok: false, reason: "That chore can't be cleared as not needed." };
  }`,
      `if (!opts.allowsSkip) {
    return { ok: false, reason: "That chore can't be cleared as not needed." };
  }
  // Farm-race / anyone-can-do chores are never skippable — only per-kid (ALL/SPECIFIC) chores.
  if (opts.assignmentMode === "RACE") {
    return { ok: false, reason: "Shared family chores can't be cleared as not needed." };
  }`
    );
    fs.writeFileSync(p, s);
    console.log("patched choreSkip gate");
  } else console.log("choreSkip already has RACE block");
}

// choreSkip.test.ts — RACE with allowsSkip still false; add explicit test
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/packages/shared/src/choreSkip.test.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    `test("skip gate blocks race taken", () => {
  const g = choreSkipGate({
    allowsSkip: true,
    isActive: true,
    periodEligible: true,
    assignmentMode: "RACE",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: true,
  });
  assert.equal(g.ok, false);
});`,
    `test("skip gate blocks race taken", () => {
  const g = choreSkipGate({
    allowsSkip: true,
    isActive: true,
    periodEligible: true,
    assignmentMode: "RACE",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: true,
  });
  assert.equal(g.ok, false);
});

test("skip gate blocks farm-race even when allowsSkip true", () => {
  const g = choreSkipGate({
    allowsSkip: true,
    isActive: true,
    periodEligible: true,
    assignmentMode: "RACE",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: false,
  });
  assert.equal(g.ok, false);
});`
  );
  fs.writeFileSync(p, s);
  console.log("patched choreSkip.test");
}

// choreCatalog.test.ts
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/packages/shared/src/choreCatalog.test.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/seed catalog has 27 unique slugs/g, "seed catalog has 26 unique slugs");
  s = s.replace(/CHORE_CATALOG\.length, 27/g, "CHORE_CATALOG.length, 26");
  s = s.replace(/new Set\(slugs\)\.size, 27/g, "new Set(slugs).size, 26");
  s = s.replace(
    `test("may-need afternoon chores are DAILY + AFTERNOON", () => {
  const empty = CHORE_CATALOG.find((r) => r.slug === "empty-dishwasher");
  const hw = CHORE_CATALOG.find((r) => r.slug === "do-homework");
  const snack = CHORE_CATALOG.find((r) => r.slug === "clean-snack-mess");
  assert.ok(empty && hw && snack);
  for (const row of [empty, hw, snack]) {
    assert.equal(row.recurrence, "DAILY");
    assert.equal(row.timeOfDay, "AFTERNOON");
    assert.equal(row.includeInPath, true);
    assert.equal(row.allowsSkip, true);
  }
  assert.equal(empty.isGlobal, false);
  assert.equal(assignmentModeForSeed(empty), "RACE");
  assert.equal(hw.isGlobal, true);
  assert.equal(hw.priority, "HIGH");
  assert.equal(snack.isGlobal, true);
  assert.equal(empty.priority, "NORMAL");
  assert.equal(snack.priority, "NORMAL");
});`,
    `test("may-need afternoon chores are DAILY + AFTERNOON per kid", () => {
  const dishes = CHORE_CATALOG.find((r) => r.slug === "dishes-1-6");
  const hw = CHORE_CATALOG.find((r) => r.slug === "do-homework");
  const snack = CHORE_CATALOG.find((r) => r.slug === "clean-snack-mess");
  assert.ok(dishes && hw && snack);
  for (const row of [dishes, hw, snack]) {
    assert.equal(row.recurrence, "DAILY");
    assert.equal(row.timeOfDay, "AFTERNOON");
    assert.equal(row.includeInPath, true);
    assert.equal(row.allowsSkip, true);
    assert.equal(row.isGlobal, true);
    assert.equal(assignmentModeForSeed(row), "ALL");
  }
  assert.equal(dishes.title, "Dishes");
  assert.equal(hw.priority, "HIGH");
  assert.equal(snack.priority, "NORMAL");
  assert.equal(CHORE_CATALOG.some((r) => r.slug === "empty-dishwasher"), false);
});`
  );
  s = s.replace(
    `  const skipOk = [
    "dishes-1-6",
    "take-out-trash",
    "empty-dishwasher",
    "do-homework",
    "clean-snack-mess",
    "clean-shoe-room",
    "clean-table",
  ];
  const skipNo = [
    "feed-dog-am",
    "feed-dog-pm",
    "walk-the-dog",
    "brush-teeth-am",
    "brush-teeth-bedtime",
    "make-your-bed",
    "hang-backpack",
    "shoes-on-rack",
    "water-bottle-backpack",
  ];`,
    `  const skipOk = [
    "dishes-1-6",
    "do-homework",
    "clean-snack-mess",
  ];
  const skipNo = [
    "feed-dog-am",
    "feed-dog-pm",
    "walk-the-dog",
    "brush-teeth-am",
    "brush-teeth-bedtime",
    "make-your-bed",
    "hang-backpack",
    "shoes-on-rack",
    "water-bottle-backpack",
    "take-out-trash",
    "clean-table",
    "clean-shoe-room",
  ];`
  );
  fs.writeFileSync(p, s);
  console.log("patched choreCatalog.test");
}

// seed: deactivate empty-dishwasher if present
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/api/src/chores.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("empty-dishwasher")) {
    // insert after SYNC_ALLOWS_SKIP block or end of seed loop
  }
  if (!s.includes('slug: "empty-dishwasher"')) {
    const marker = "  // SYNC_ALLOWS_SKIP";
    const inject = `  // Deduped into dishes-1-6 — hide legacy empty-dishwasher if it was seeded.
  await prisma.chore.updateMany({
    where: { slug: "empty-dishwasher" },
    data: { isActive: false },
  });

`;
    if (s.includes(marker) && !s.includes("Deduped into dishes-1-6")) {
      s = s.replace(marker, inject + marker);
      fs.writeFileSync(p, s);
      console.log("seed deactivates empty-dishwasher");
    } else if (s.includes("Deduped into dishes-1-6")) {
      console.log("seed deactivate already present");
    } else {
      console.log("WARN could not find SYNC marker");
    }
  }
}

// Also sync isGlobal/assignmentMode for dishes on seed update path
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/api/src/chores.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("isGlobal: row.isGlobal")) {
    s = s.replace(
      `data: {
          recurrence: row.recurrence,
          timeOfDay: row.timeOfDay,
          includeInPath: row.includeInPath,
          priority: row.priority,
          assignmentMode,
        },`,
      `data: {
          title: row.title,
          recurrence: row.recurrence,
          timeOfDay: row.timeOfDay,
          includeInPath: row.includeInPath,
          priority: row.priority,
          isGlobal: row.isGlobal,
          allowsSkip: row.allowsSkip,
          assignmentMode,
        },`
    );
    fs.writeFileSync(p, s);
    console.log("seed update syncs isGlobal/allowsSkip/title");
  } else console.log("seed update already syncs isGlobal");
}
