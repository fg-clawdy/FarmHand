const fs = require("fs");
const s = fs.readFileSync("C:/Users/theha/Documents/GIT/FarmHand/packages/shared/src/choreCatalog.ts", "utf8");
const re = /slug: "([^"]+)"[\s\S]*?title: "([^"]+)"[\s\S]*?allowsSkip: (true|false)/g;
let m;
const rows = [];
while ((m = re.exec(s))) rows.push(m);
for (const row of rows) console.log((row[3] === "true" ? "SKIP" : "----") + "\t" + row[1] + "\t" + row[2]);
console.log("skippable " + rows.filter((r) => r[3] === "true").length + " / " + rows.length);
