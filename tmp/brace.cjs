const fs = require("fs");
const s = fs.readFileSync("C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/screens/Garden.tsx","utf8");
let depth = 0;
const lines = s.split(/\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  // rough
  if (i >= 490 && i <= 510) console.log((i+1) + " d=" + depth + " " + line.slice(0,80));
  depth += opens - closes;
}
console.log("final depth", depth);
