const fs = require("fs");
const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/api/src/chores.ts";
let s = fs.readFileSync(p, "utf8");
const needle = `    } else {
      // Keep parent edits for title/emoji/etc.; refresh schedule tags from catalog so Job Board ranking stays in sync.
      await prisma.chore.update({
        where: { slug: row.slug },
        data: {
          recurrence: row.recurrence,
          timeOfDay: row.timeOfDay,
          includeInPath: row.includeInPath,
          priority: row.priority,
          assignmentMode,
        },
      });
    }`;
const repl = `    } else {
      // Keep parent edits for emoji/etc.; refresh schedule/assignment/skip from catalog.
      await prisma.chore.update({
        where: { slug: row.slug },
        data: {
          title: row.title,
          recurrence: row.recurrence,
          timeOfDay: row.timeOfDay,
          includeInPath: row.includeInPath,
          priority: row.priority,
          isGlobal: row.isGlobal,
          allowsSkip: row.allowsSkip,
          assignmentMode,
        },
      });
    }`;
if (!s.includes(needle)) {
  console.log("NEEDLE MISS");
  const idx = s.indexOf("Keep parent edits");
  console.log("snippet", JSON.stringify(s.slice(idx, idx + 350)));
} else {
  s = s.replace(needle, repl);
  fs.writeFileSync(p, s);
  console.log("OK patched else update");
}
