const fs = require("fs");

// Fix FarmJobFlow onSkip
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/components/FarmJobFlow.tsx";
  let s = fs.readFileSync(p, "utf8");
  const bad = `        onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            setError(data.toast || "Not needed · +1 shard");
            window.setTimeout(() => setError((cur) => (cur === (data.toast || "Not needed · +1 shard") ? "" : cur)), 2800);
            return data.player;
          }}`;
  const good = `        onSkip={async (chore) => {
          const data = await api.skipChore(chore.id);
          if (data.chores) setChores(data.chores);
          setKid(data.player);
          return data.player;
        }}`;
  if (!s.includes("applyGarden(data.player)")) {
    console.log("FarmJobFlow: applyGarden already gone?");
  } else {
    if (!s.includes(bad)) {
      // fuzzy replace
      s = s.replace(/onSkip=\{async \(chore\) => \{[\s\S]*?return data\.player;\s*\}\}/m, good.trim().replace(/^        /, ""));
      // more careful
    }
    s = s.replace(
      /onSkip=\{async \(chore\) => \{\s*const data = await api\.skipChore\(chore\.id\);\s*if \(data\.chores\) setChores\(data\.chores\);\s*applyGarden\(data\.player\);\s*setError\([^;]+;\s*window\.setTimeout\(\(\) => setError\(\(cur\) =>[^)]+\)\), 2800\);\s*return data\.player;\s*\}\}/,
      good.trim()
    );
    fs.writeFileSync(p, s);
    console.log("FarmJobFlow patched", !s.includes("applyGarden"));
  }
}

// Fix Garden onSkip — JobBoard already toasts; just apply garden + refresh chores
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/screens/Garden.tsx";
  let s = fs.readFileSync(p, "utf8");
  const re = /onSkip=\{async \(chore\) => \{\s*const data = await api\.skipChore\(chore\.id\);\s*if \(data\.chores\) setChores\(data\.chores\);\s*applyGarden\(data\.player\);\s*setError\([^;]+;\s*window\.setTimeout\(\(\) => setError\(\(cur\) =>[^)]+\)\), 2800\);\s*return data\.player;\s*\}\}/;
  const good = `onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            return data.player;
          }}`;
  if (!re.test(s)) {
    console.log("Garden: pattern miss");
    const idx = s.indexOf("onSkip=");
    console.log(JSON.stringify(s.slice(idx, idx + 280)));
  } else {
    s = s.replace(re, good);
    fs.writeFileSync(p, s);
    console.log("Garden patched");
  }
}
