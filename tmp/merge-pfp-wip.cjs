const fs = require("fs");

// Garden: add onSkip + timezone
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/screens/Garden.tsx";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("onSkip=")) {
    s = s.replace(
      `onClaim={async (chore) => {
            const data = await api.claimChore(chore.id);
            setOverlay(null);
            applyGarden(data.player);
            noteUnlocks(data.unlocks);
            celebrateWaitingSeed();
            return data.player;
          }}
          onNeedPhoto={(chore) => setOverlay({ type: "chore-photo", chore })}`,
      `timezone={choreTimezone}
          onClaim={async (chore) => {
            const data = await api.claimChore(chore.id);
            setOverlay(null);
            applyGarden(data.player);
            noteUnlocks(data.unlocks);
            celebrateWaitingSeed();
            return data.player;
          }}
          onSkip={async (chore) => {
            const data = await api.skipChore(chore.id);
            if (data.chores) setChores(data.chores);
            applyGarden(data.player);
            return data.player;
          }}
          onNeedPhoto={(chore) => setOverlay({ type: "chore-photo", chore })}`
    );
    // ensure choreTimezone exists
    if (!s.includes("choreTimezone")) {
      console.log("WARN no choreTimezone in Garden — check");
    }
    fs.writeFileSync(p, s);
    console.log("Garden onSkip+timezone added", s.includes("onSkip="));
  } else console.log("Garden already has onSkip");
}

// Re-add compact job board CSS before kid-avatar block
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/styles.css";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("job-board--compact")) {
    const block = `
/* Garden Job Board — compact centered modal (not full-page) */
.job-board-backdrop--modal {
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.job-board--compact {
  flex: 0 1 auto;
  width: min(820px, 96vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}
.job-board--compact .job-board-header h2 {
  font-size: 26px;
}
.job-board--compact .job-board-body {
  padding: 12px 14px 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.job-board--compact .job-section h3 {
  margin: 0 0 8px;
  font-size: 15px;
}
.job-board--compact .job-grid-now {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 10px;
}
.job-board--compact .job-card {
  min-height: 132px;
  padding: 16px 10px 12px;
  border-radius: 18px;
}
.job-board--compact .job-card-emoji {
  font-size: 36px;
}
.job-board--compact .job-card-title {
  font-size: 14px;
}
.job-board--expanded {
  width: min(920px, 98vw);
}
.job-row-scroll {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 2px 12px;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
}
.job-row-scroll .job-card {
  flex: 0 0 148px;
  width: 148px;
  scroll-snap-align: start;
}

`;
    s = s.replace(
      ".job-more-toggle:active { transform: translateY(2px); }\n",
      ".job-more-toggle:active { transform: translateY(2px); }\n" + block
    );
    fs.writeFileSync(p, s);
    console.log("compact CSS restored", s.includes("job-board--compact"));
  } else console.log("compact CSS ok");
}
