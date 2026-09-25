const fs = require("fs");

function replaceBetween(s, startMarker, endMarker, replacement) {
  const a = s.indexOf(startMarker);
  if (a < 0) throw new Error("start miss: " + startMarker.slice(0, 40));
  const b = s.indexOf(endMarker, a);
  if (b < 0) throw new Error("end miss");
  return s.slice(0, a) + replacement + s.slice(b);
}

{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/components/FarmJobFlow.tsx";
  let s = fs.readFileSync(p, "utf8");
  s = replaceBetween(
    s,
    "onSkip={async (chore) => {",
    "onNeedPhoto={(chore) => {",
    `onSkip={async (chore) => {
          const data = await api.skipChore(chore.id);
          if (data.chores) setChores(data.chores);
          setKid(data.player);
          return data.player;
        }}
        `
  );
  fs.writeFileSync(p, s);
  console.log("FarmJobFlow ok", !s.includes("applyGarden"), !s.includes("setError"));
}

{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/screens/Garden.tsx";
  let s = fs.readFileSync(p, "utf8");
  s = replaceBetween(
    s,
    "onSkip={async (chore) => {",
    "onNeedPhoto={(chore) => setOverlay({ type: \"chore-photo\", chore })}",
    `onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            return data.player;
          }}
          `
  );
  fs.writeFileSync(p, s);
  console.log("Garden ok", !s.includes("Not needed"));
}
