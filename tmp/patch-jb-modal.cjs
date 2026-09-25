const fs = require("fs");

// --- JobBoard.tsx ---
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/components/JobBoard.tsx";
  let s = fs.readFileSync(p, "utf8");
  const oldReturn = `  return (
    <>
      <div className="job-board-backdrop" role="dialog" aria-label="Job Board">
        <div className="job-board">
          <header className="job-board-header">
            <div>
              <p className="job-board-kicker">{kidName ? \`\${kidName}'s jobs\` : "Barn jobs"}</p>
              <h2>Job Board</h2>
            </div>
            <button className="job-board-close" type="button" onClick={onClose} aria-label="Close Job Board">
              Close
            </button>
          </header>
          <p className="job-board-intro">
            A few chores that fit right now. Need something else? Open More chores — everything is still there.
          </p>
          <div className="job-board-scroll">
            {chores.length === 0 && <p className="job-board-empty">Looking for jobs…</p>}
            {chores.length > 0 && suggested.length === 0 && more.length === 0 && (
              <p className="job-board-empty">No open jobs right now. Check the done-for-now list below.</p>
            )}
            {suggested.length > 0 && (
              <section className="job-section">
                <h3>{sectionTitle}</h3>
                <div className="job-grid job-grid-now">
                  {suggested.map((chore) => (
                    <JobCard key={chore.id} chore={chore} onPick={() => pick(chore)} />
                  ))}
                </div>
              </section>
            )}
            {more.length > 0 && (
              <section className="job-section">
                <button
                  type="button"
                  className="job-more-toggle"
                  aria-expanded={showMore}
                  onClick={() => setShowMore((v) => !v)}
                >
                  {showMore ? "Hide extra chores" : \`More chores (\${more.length})\`}
                </button>
                {showMore && (
                  <div className="job-grid">
                    {more.map((chore) => (
                      <JobCard key={chore.id} chore={chore} onPick={() => pick(chore)} />
                    ))}
                  </div>
                )}
              </section>
            )}
            {done.length > 0 && (
              <section className="job-section job-section-muted">
                <h3>Done for now</h3>
                <div className="job-grid">
                  {done.map((chore) => (
                    <JobCard key={chore.id} chore={chore} muted />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>`;

  const newReturn = `  const moreCount = more.length + done.length;

  return (
    <>
      <div className="job-board-backdrop job-board-backdrop--modal" role="dialog" aria-label="Job Board">
        <div className={\`job-board job-board--compact\${showMore ? " job-board--expanded" : ""}\`}>
          <header className="job-board-header">
            <div>
              <p className="job-board-kicker">{kidName ? \`\${kidName}'s jobs\` : "Barn jobs"}</p>
              <h2>Job Board</h2>
            </div>
            <button className="job-board-close" type="button" onClick={onClose} aria-label="Close Job Board">
              Close
            </button>
          </header>
          <div className="job-board-body">
            {chores.length === 0 && <p className="job-board-empty">Looking for jobs…</p>}
            {chores.length > 0 && suggested.length === 0 && more.length === 0 && done.length === 0 && (
              <p className="job-board-empty">No open jobs right now. Check back soon.</p>
            )}
            {suggested.length > 0 && (
              <section className="job-section">
                <h3>{sectionTitle}</h3>
                <div className="job-grid job-grid-now">
                  {suggested.map((chore) => (
                    <JobCard key={chore.id} chore={chore} onPick={() => pick(chore)} />
                  ))}
                </div>
              </section>
            )}
            {moreCount > 0 && (
              <section className="job-section">
                <button
                  type="button"
                  className="job-more-toggle"
                  aria-expanded={showMore}
                  onClick={() => setShowMore((v) => !v)}
                >
                  {showMore ? "Hide extra chores" : \`More chores (\${moreCount})\`}
                </button>
                {showMore && (
                  <div className="job-row-scroll" role="list">
                    {more.map((chore) => (
                      <JobCard key={chore.id} chore={chore} onPick={() => pick(chore)} />
                    ))}
                    {done.map((chore) => (
                      <JobCard key={chore.id} chore={chore} muted />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>`;

  if (!s.includes("job-board--compact")) {
    if (!s.includes("A few chores that fit right now")) {
      console.log("JobBoard: unexpected content, trying marker replace");
    }
    const start = s.indexOf("  return (\n    <>\n      <div className=\"job-board-backdrop\"");
    const end = s.indexOf("      {picked && (");
    if (start < 0 || end < 0) {
      console.log("markers miss", start, end);
    } else {
      s = s.slice(0, start) + newReturn + "\n" + s.slice(end);
      fs.writeFileSync(p, s);
      console.log("JobBoard.tsx updated");
    }
  } else {
    console.log("JobBoard already compact");
  }
}

// --- styles.css ---
{
  const p = "C:/Users/theha/Documents/GIT/FarmHand/apps/player/src/styles.css";
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("job-board--compact")) {
    console.log("CSS already has compact");
  } else {
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
    console.log("styles.css updated");
  }
}
