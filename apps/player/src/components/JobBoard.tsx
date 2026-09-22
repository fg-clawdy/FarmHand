import { useEffect, useState } from "react";
import type { FamilyJob, GardenPlayer, PublicChore } from "../api";
import JobCoach from "./JobCoach";
import Sheet from "./Sheet";

function flyerSrc(chore: { slug?: string; flyerUrl?: string | null }) {
  if (chore.flyerUrl) return chore.flyerUrl;
  if (chore.slug) return `/api/media/wanted/${chore.slug}.png`;
  return null;
}

export function NeedJobsNudge({ onClose, onOpenJobs }: { onClose: () => void; onOpenJobs: () => void }) {
  return (
    <JobCoach
      title="Need a seed?"
      copy="Your seed pouch is empty. Do a job on the Job Board to plant a waiting seed — jobs do not spend pouch seeds."
      cta="Do a job to plant a waiting seed"
      cancelLabel="Back to garden"
      onClose={onClose}
      onContinue={onOpenJobs}
    />
  );
}

export function FamilyJobBoard({
  jobs,
  onClose,
  onPick,
}: {
  jobs: FamilyJob[];
  onClose: () => void;
  onPick: (job: FamilyJob) => void;
}) {
  const pinned = jobs.filter((job) => job.priority === "CRITICAL");
  const openJobs = jobs.filter((job) => job.priority !== "CRITICAL");
  return (
    <div className="job-board-backdrop" role="dialog" aria-label="Job Board">
      <div className="job-board">
        <header className="job-board-header">
          <div>
            <p className="job-board-kicker">Family corkboard</p>
            <h2>Job Board</h2>
          </div>
          <button className="job-board-close" type="button" onClick={onClose} aria-label="Close Job Board">
            Close
          </button>
        </header>
        <p className="job-board-intro">
          Open jobs for someone in the family. Tap a poster to claim — you'll pick who you are then.
        </p>
        <div className="job-board-scroll">
          {jobs.length === 0 && <p className="job-board-empty">No open jobs right now. Check back soon.</p>}
          {pinned.length > 0 && (
            <section className="job-section">
              <h3>Pinned · dogs first</h3>
              <div className="job-grid job-grid-pinned">
                {pinned.map((job) => (
                  <JobCard key={job.id} chore={job} onPick={() => onPick(job)} />
                ))}
              </div>
            </section>
          )}
          {openJobs.length > 0 && (
            <section className="job-section">
              <h3>{pinned.length > 0 ? "More jobs" : "Open jobs"}</h3>
              <div className="job-grid">
                {openJobs.map((job) => (
                  <JobCard key={job.id} chore={job} onPick={() => onPick(job)} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JobBoard({
  chores,
  busy,
  onClose,
  onClaim,
  onNeedPhoto,
  kidName,
  initialChoreId,
}: {
  chores: PublicChore[];
  busy: boolean;
  onClose: () => void;
  onClaim: (chore: PublicChore) => Promise<GardenPlayer>;
  onNeedPhoto: (chore: PublicChore) => void;
  kidName?: string;
  initialChoreId?: string | null;
}) {
  const [picked, setPicked] = useState<PublicChore | null>(null);
  const [error, setError] = useState("");
  const eligible = chores.filter((chore) => chore.eligible);
  const pinned = eligible.filter((chore) => chore.priority === "CRITICAL");
  const openJobs = eligible.filter((chore) => chore.priority !== "CRITICAL");
  const done = chores.filter((chore) => !chore.eligible);

  useEffect(() => {
    if (!initialChoreId) return;
    const chore = chores.find((row) => row.id === initialChoreId);
    if (!chore) return;
    if (chore.eligible) {
      setPicked(chore);
      setError("");
      return;
    }
    setPicked(null);
    setError(chore.reason || "That chore isn't assigned to you.");
  }, [initialChoreId, chores]);

  async function claim(chore: PublicChore) {
    setError("");
    if (chore.requiresSelfie) {
      onNeedPhoto(chore);
      return;
    }
    try {
      await onClaim(chore);
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
              <p className="job-board-kicker">{kidName ? `${kidName}'s jobs` : "Barn jobs"}</p>
              <h2>Job Board</h2>
            </div>
            <button className="job-board-close" type="button" onClick={onClose} aria-label="Close Job Board">
              Close
            </button>
          </header>
          <p className="job-board-intro">
            Tap a job to plant a waiting seed. Stars come later, when a grown-up says yes and you harvest.
          </p>
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
                    <JobCard key={chore.id} chore={chore} onPick={() => pick(chore)} />
                  ))}
                </div>
              </section>
            )}
            {openJobs.length > 0 && (
              <section className="job-section">
                <h3>{pinned.length > 0 ? "More jobs" : "Open jobs"}</h3>
                <div className="job-grid">
                  {openJobs.map((chore) => (
                    <JobCard key={chore.id} chore={chore} onPick={() => pick(chore)} />
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
          <p className="chore-label">+1 seed to your pouch</p>
          {error && <p className="error">{error}</p>}
          <div className={`sheet-actions ${busy ? "busy" : ""}`}>
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={() => void claim(picked)}
            >
              {picked.requiresSelfie ? "Take photo & plant" : "Claim job"}
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

type JobCardChore = {
  id: string;
  title: string;
  emoji: string;
  priority: string;
  slug?: string;
  flyerUrl?: string | null;
  requiresSelfie?: boolean;
  reason?: string | null;
};

function JobCard({
  chore,
  muted = false,
  onPick,
}: {
  chore: JobCardChore;
  muted?: boolean;
  onPick?: () => void;
}) {
  const critical = chore.priority === "CRITICAL";
  const flyer = flyerSrc(chore);
  return (
    <button
      type="button"
      className={`job-card ${critical ? "critical" : ""} ${muted ? "muted" : ""} ${flyer ? "has-flyer" : ""}`}
      disabled={muted}
      onClick={() => onPick?.()}
      aria-label={chore.title}
    >
      <span className="job-card-pin" aria-hidden="true">
        {critical ? "📌" : "📎"}
      </span>
      {flyer ? (
        <img className="job-card-flyer" src={flyer} alt="" draggable={false} />
      ) : (
        <>
          <span className="job-card-emoji">{chore.emoji}</span>
          <b className="job-card-title">{chore.title}</b>
        </>
      )}
      <span className="job-chip">+1 waiting seed</span>
      {chore.requiresSelfie && <span className="job-photo">Needs a photo</span>}
      {muted && chore.reason && <small className="job-reason">{chore.reason}</small>}
    </button>
  );
}
