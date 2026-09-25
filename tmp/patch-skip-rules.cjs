const fs = require("fs");
const p = "C:/Users/theha/Documents/GIT/FarmHand/packages/shared/src/choreCatalog.ts";
let s = fs.readFileSync(p, "utf8");

// Remove empty-dishwasher block entirely
s = s.replace(/\n  \{\n    slug: "empty-dishwasher",[\s\S]*?\n  \},/, "\n");

// dishes-1-6: per-kid, skippable, afternoon — retitle to Dishes
function patchSlug(slug, fields) {
  const re = new RegExp(`(slug: "${slug}"[\\s\\S]*?)(\\n  \\},)`);
  const m = s.match(re);
  if (!m) { console.log("MISS", slug); return; }
  let block = m[1];
  for (const [key, val] of Object.entries(fields)) {
    const fr = new RegExp(key + ": [^,\\n]+");
    if (fr.test(block)) block = block.replace(fr, key + ": " + val);
    else console.log("no field", slug, key);
  }
  s = s.replace(re, block + m[2]);
  console.log("patched", slug);
}

patchSlug("dishes-1-6", {
  title: '"Dishes"',
  timeOfDay: '"AFTERNOON"',
  allowsSkip: "true",
  isGlobal: "true",
  includeInPath: "true",
});

// Race / anyone: no skip
for (const slug of ["take-out-trash", "clean-table", "clean-shoe-room"]) {
  patchSlug(slug, { allowsSkip: "false" });
}

// Per-kid skippables stay true
for (const slug of ["do-homework", "clean-snack-mess"]) {
  patchSlug(slug, { allowsSkip: "true", isGlobal: "true" });
}

fs.writeFileSync(p, s);
console.log("catalog written, empty-dishwasher removed?", !s.includes('slug: "empty-dishwasher"'));
