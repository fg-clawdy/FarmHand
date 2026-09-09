import { useEffect, useState } from "react";
import type { GameConfig } from "@farmhand/shared";
import type { GardenPlayer, PublicChore } from "../api";
import Sheet from "./Sheet";

export function NeedJobsNudge({ onClose, onOpenJobs }: { onClose: () => void; onOpenJobs: () => void }) {
  return (
    <Sheet title="Need a seed?" onClose={onClose}>
      <p className="chore-copy">
        Your seed pouch is empty. Do a job on the Job Board to plant a <b>waiting seed</b> — jobs do not spend pouch
        seeds.
      </p>
      <div className="sheet-actions">
        <button className="btn gold" type="button" onClick={onOpenJobs}>
          Do a job to plant a waiting seed
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          Back to garden
        </button>
      </div>
    </Sheet>
  );
}

export default function JobBoard({
  chores,
  emptySlots,
  config,
  busy,
  onClose,
  onClaim,
  onNeedPhoto,
}: {
  chores: PublicChore[];
  emptySlots: number[];
  config: GameConfig;
  busy: boolean;
  onClose: () => void;
  onClaim: (chore: PublicChore, slot: number, tier: number) => Promise<GardenPlayer>;
  onNeedPhoto: (chore: PublicChore, slot: number, tier: number) => void;
}) {
  const [picked, setPicked] = useState<PublicChore | null>(null);
  const [slot, setSlot] = useState<number | null>(emptySlots[0] ?? null);
  const [tier, setTier] = useState(config.tiers[0]?.tier ?? 1);
  const [error, setError] = useState("");
  const gardenFull = emptySlots.length === 0;
  const eligible = chores.filter((chore) => chore.eligible);
  const pinned = eligible.filter((chore) => chore.priority === "CRITICAL");
  const openJobs = eligible.filter((chore) => chore.priority !== "CRITICAL");
  const done = chores.filter((chore) => !chore.eligible);
  const defaultTier = config.tiers[0]?.tier ?? 1;

  useEffect(() => {
    setSlot(emptySlots[0] ?? null);
  }, [emptySlots]);

  async function claim(chore: PublicChore, nextSlot: number, nextTier: number) {
    setError("");
    if (emptySlots.length === 0) {
      setError("Need an empty plot first. Harvest or prune something.");
      return;
    }
    if (chore.requiresSelfie) {
      onNeedPhoto(chore, nextSlot, nextTier);
      return;
    }
    try {
      await onClaim(chore, nextSlot, nextTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  function pick(chore: PublicChore) {
    setPicked(chore);
    setError("");
  }

  return (
    <>
      <div className="job-board-backdrop" role="dialog" aria-label="Job Board">
        <div className="job-board">
          <header className="job-board-header">
            <div>
              <p className="job-board-kicker">Barn jobs</p>
              <h2>Job Board</h2>
            </div>
            <button className="job-board-close" type="button" onClick={onClose} aria-label="Close Job Board">
              Close
            </button>
          </header>
          <p className="job-board-intro">
            Tap a job to plant a waiting seed. Stars come later, when a grown-up says yes and you harvest.
          </p>
          {gardenFull && (
            <p className="job-board-banner" role="status">
              Garden is full. Harvest or prune a plant before you claim a job.
            </p>
          )}
          <div className="job-board-scroll">
            {chores.length === 0 && <p className="job-board-empty">Looking for jobs…</p>}
            {chores.length > 0 && eligible.length === 0 && (
              <p className="job-board-empty">No open jobs right now. Check the done-for-now list below.</p>
            )}
            {pinned.length > 0 && (
              <section className="job-section">
                <h3>Pinned · dogs first</h3>
                <div className="job-grid job-grid-pinned">
                  {pinned.map((chore) => (
                    <JobCard key={chore.id} chore={chore} onPick={pick} />
                  ))}
                </div>
              </section>
            )}
            {openJobs.length > 0 && (
              <section className="job-section">
                <h3>{pinned.length > 0 ? "More jobs" : "Open jobs"}</h3>
                <div className="job-grid">
                  {openJobs.map((chore) => (
                    <JobCard key={chore.id} chore={chore} onPick={pick} />
                  ))}
                </div>
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
      </div>
      {picked && (
        <Sheet title={picked.title} onClose={() => setPicked(null)}>
          <p className="chore-copy">
            {picked.emoji} {picked.description || "Do the chore, then plant a waiting seed."}
          </p>
          {gardenFull ? (
            <p className="error">Need an empty plot first. Harvest or prune something.</p>
          ) : (
            <>
              <p className="chore-label">Empty plot</p>
              <div className="chore-beds">
                {Array.from({ length: 9 }, (_, s) => {
                  const open = emptySlots.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`chore-bed ${open ? "" : "full"} ${slot === s ? "selected" : ""}`}
                      disabled={!open}
                      aria-label={open ? "Empty mound" : "Occupied mound"}
                      onClick={() => setSlot(s)}
                    />
                  );
                })}
              </div>
              <p className="chore-label">Plant</p>
              <div className="chore-slots">
                {config.tiers.map((t) => (
                  <button
                    key={t.tier}
                    type="button"
                    className={`chore-slot ${tier === t.tier ? "selected" : ""}`}
                    onClick={() => setTier(t.tier)}
                  >
                    {t.emoji} {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <div className={`sheet-actions ${busy ? "busy" : ""}`}>
            <button
              className="btn primary"
              type="button"
              disabled={busy || slot == null || gardenFull}
              onClick={() => void claim(picked, slot ?? emptySlots[0]!, tier || defaultTier)}
            >
              {picked.requiresSelfie ? "Take photo & plant" : "Plant waiting seed"}
            </button>
            <button className="btn ghost" type="button" onClick={() => setPicked(null)}>
              Back to board
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function JobCard({
  chore,
  muted = false,
  onPick,
}: {
  chore: PublicChore;
  muted?: boolean;
  onPick?: (chore: PublicChore) => void;
}) {
  const critical = chore.priority === "CRITICAL";
  return (
    <button
      type="button"
      className={`job-card ${critical ? "critical" : ""} ${muted ? "muted" : ""}`}
      disabled={muted}
      onClick={() => onPick?.(chore)}
    >
      <span className="job-card-pin" aria-hidden="true">
        {critical ? "📌" : "📎"}
      </span>
      <span className="job-card-emoji">{chore.emoji}</span>
      <b className="job-card-title">{chore.title}</b>
      <span className="job-chip">+1 waiting seed</span>
      {chore.requiresSelfie && <span className="job-photo">Needs a photo</span>}
      {muted && chore.reason && <small className="job-reason">{chore.reason}</small>}
    </button>
  );
}
