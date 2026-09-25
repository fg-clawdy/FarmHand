import { useEffect, useMemo, useRef, useState } from "react";
import { partitionEligibleChoresForNow } from "@farmhand/shared";
import type { FamilyJob, GardenPlayer, PublicChore } from "../api";
import { recordBoardEvent } from "../choreBoardEvents";
import ChoreConfirmHero from "./ChoreConfirmHero";
import JobCoach from "./JobCoach";
import Sheet from "./Sheet";
import { kidSeedRewardLabel } from "../kidSeedReward";

export function NeedJobsNudge({ onClose, onOpenJobs }: { onClose: () => void; onOpenJobs: () => void }) {
  return (
    <JobCoach
      title="Need a seed?"
      copy="Your seed pouch is empty. Do a job on the Job Board to earn seeds for your bag — jobs do not spend pouch seeds."
      cta="Do a job for seeds"
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

  useEffect(() => {
    recordBoardEvent({ eventType: "BOARD_OPEN", source: "FARM_CORKBOARD" });
    return () => {
      recordBoardEvent({ eventType: "DISMISS", source: "FARM_CORKBOARD" });
    };
  }, []);

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
  onSkip,
  onNeedPhoto,
  kidName,
  initialChoreId,
  timezone = "America/Chicago",
}: {
  chores: PublicChore[];
  busy: boolean;
  onClose: () => void;
  onClaim: (chore: PublicChore) => Promise<GardenPlayer>;
  /** Honest skip — optional chores only; grants +1 shard. */
  onSkip?: (chore: PublicChore) => Promise<GardenPlayer>;
  onNeedPhoto: (chore: PublicChore) => void;
  kidName?: string;
  initialChoreId?: string | null;
  /** Family timezone for Right now scoring (from /api/chores). */
  timezone?: string;
}) {
  const [picked, setPicked] = useState<PublicChore | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showMore, setShowMore] = useState(false);
  const done = chores.filter((chore) => !chore.eligible);

  const heatByChoreId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of chores) {
      if (typeof c.heatScore === "number") map[c.id] = c.heatScore;
    }
    return map;
  }, [chores]);

  const partition = useMemo(
    () => partitionEligibleChoresForNow(chores, { timeZone: timezone, heatByChoreId }),
    [chores, timezone, heatByChoreId],
  );
  const { suggested, more, sectionTitle } = partition;

  useEffect(() => {
    recordBoardEvent({ eventType: "BOARD_OPEN", source: "GARDEN_JOB_BOARD" });
    return () => {
      recordBoardEvent({ eventType: "DISMISS", source: "GARDEN_JOB_BOARD" });
    };
  }, []);

  const impressionsSent = useRef(false);
  useEffect(() => {
    if (impressionsSent.current || suggested.length === 0) return;
    impressionsSent.current = true;
    for (const chore of suggested) {
      recordBoardEvent({
        eventType: "RIGHT_NOW_IMPRESSION",
        source: "GARDEN_JOB_BOARD",
        choreId: chore.id,
        suggestedSlot: true,
      });
    }
  }, [suggested]);

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
    setToast("");
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

  async function skip(chore: PublicChore) {
    if (!onSkip || !chore.allowsSkip) return;
    setError("");
    setToast("");
    try {
      await onSkip(chore);
      setToast("Not needed · +1 shard");
      window.setTimeout(() => {
        setPicked(null);
        setToast("");
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  function pick(chore: PublicChore) {
    setPicked(chore);
    setError("");
  }

  const moreCount = more.length + done.length;
  const showSkip = Boolean(picked?.allowsSkip && picked.eligible && onSkip);

  return (
    <>
      <div className="job-board-backdrop job-board-backdrop--modal" role="dialog" aria-label="Job Board">
        <div className={`job-board job-board--compact${showMore ? " job-board--expanded" : ""}`}>
          <header className="job-board-header">
            <div>
              <p className="job-board-kicker">{kidName ? `${kidName}'s jobs` : "Barn jobs"}</p>
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
                  {showMore ? "Hide extra chores" : `More chores (${moreCount})`}
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
      </div>
      {picked && (
        <Sheet title={picked.title} onClose={() => setPicked(null)} className="sheet--chore-confirm">
          <ChoreConfirmHero
            slug={picked.slug}
            title={picked.title}
            rewardLabel={kidSeedRewardLabel(picked.rewardSeedCount, picked.rewardSeedKind)}
          />
          {error && <p className="error">{error}</p>}
          {toast && (
            <p className="chore-confirm-toast" role="status" aria-live="polite">
              {toast}
            </p>
          )}
          <div className={`sheet-actions sheet-actions--chore-confirm ${busy ? "busy" : ""}`}>
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={() => void claim(picked)}
            >
              {picked.requiresSelfie ? "Take photo & confirm" : "Confirm"}
            </button>
            {showSkip && (
              <button
                className="btn cream-secondary"
                type="button"
                disabled={busy}
                data-testid="chore-skip"
                onClick={() => void skip(picked)}
              >
                Not needed · +1 shard
              </button>
            )}
            <button className="chore-confirm-back" type="button" onClick={() => setPicked(null)}>
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
  requiresSelfie?: boolean;
  reason?: string | null;
  rewardSeedCount?: number;
  rewardSeedKind?: "seed" | "super_seed";
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
  // Garden / overlay list cards use the pre-flyer big-card look (emoji + title).
  // Wanted poster art stays on the Farm corkboard only — do not put flyers on these cards.
  return (
    <button
      type="button"
      className={`job-card ${critical ? "critical" : ""} ${muted ? "muted" : ""}`}
      disabled={muted}
      onClick={() => onPick?.()}
      aria-label={chore.title}
    >
      <span className="job-card-pin" aria-hidden="true">
        {critical ? "📌" : "📎"}
      </span>
      <span className="job-card-emoji">{chore.emoji}</span>
      <b className="job-card-title">{chore.title}</b>
      <span className="job-chip">{kidSeedRewardLabel(chore.rewardSeedCount, chore.rewardSeedKind)}</span>
      {chore.requiresSelfie && <span className="job-photo">Needs a photo</span>}
      {muted && chore.reason && <small className="job-reason">{chore.reason}</small>}
    </button>
  );
}
