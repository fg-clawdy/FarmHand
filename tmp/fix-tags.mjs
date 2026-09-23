import fs from "fs";
const p = process.argv[2];
let s = fs.readFileSync(p, "utf8");
const fixes = [
  ["dishes-1-6", "AFTERNOON"],
  ["brush-teeth-bedtime", "EVENING"],
  ["brush-your-hair", "MORNING"],
  ["set-out-school-clothes", "EVENING"],
];
for (const [slug, tod] of fixes) {
  const re = new RegExp(`(slug: "${slug}"[\\s\\S]*?timeOfDay: ")([A-Z]+)(")`);
  if (!re.test(s)) {
    console.log("MISS", slug);
    continue;
  }
  s = s.replace(re, `$1${tod}$3`);
  console.log("SET", slug, tod);
}
fs.writeFileSync(p, s);
console.log("done");
