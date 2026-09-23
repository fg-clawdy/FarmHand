const fs = require("fs");
const files = [
  "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/components/JobBoard.tsx",
  "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/components/FarmChoreClaim.tsx",
];
for (const p of files) {
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(/Not needed[^\n"]*\+1[^\n"]*/g, "Not needed · +1 shard");
  if (s === before) console.log("NO CHANGE", p);
  else {
    fs.writeFileSync(p, s);
    console.log("FIXED", p);
  }
}
