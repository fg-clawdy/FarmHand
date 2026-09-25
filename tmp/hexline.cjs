const fs = require("fs");
const lines = fs.readFileSync("C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/screens/Garden.tsx","utf8").split(/\n/);
for (const n of [502,503,504]) {
  const line = lines[n-1];
  console.log("LINE", n);
  console.log([...line].map(c => c + "(" + c.charCodeAt(0).toString(16) + ")").join(" "));
}
