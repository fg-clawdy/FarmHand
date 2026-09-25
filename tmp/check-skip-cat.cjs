const fs=require("fs");
const s=fs.readFileSync("C:/Users/theha/Documents/GIT/FarmHand/tmp/fh-skip-dropin/packages/shared/src/choreCatalog.ts","utf8");
for (const [slug,want] of [["dishes-1-6","AFTERNOON"],["brush-teeth-bedtime","EVENING"],["brush-your-hair","MORNING"],["set-out-school-clothes","EVENING"],["take-out-trash","SKIP"]]) {
  const m=s.match(new RegExp('slug: "'+slug+'"[\\s\\S]*?timeOfDay: "([A-Z]+)"[\\s\\S]*?allowsSkip: (true|false)'));
  console.log(slug, m?("tod="+m[1]+" skip="+m[2]):"MISS", "want", want);
}
