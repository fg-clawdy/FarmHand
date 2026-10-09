import { kidColor, type FarmPlayerCard } from "@farmhand/shared";
import { useState } from "react";
import type { ActivePlaybook, PublicChore } from "../api";
import { kidSeedRewardLabel } from "../kidSeedReward";
import KidAvatar from "./KidAvatar";
import Sheet from "./Sheet";

/** One kid's (or the shared farm's) open mission bundle. */
export type CoachMission = {
  playerId?: string;
  kidName?: string;
  mascot?: FarmPlayerCard["mascot"];
  avatarKind?: string | null;
  avatarPreset?: string | null;
  avatarUrl?: string | null;
  color?: string | null;
  playbook: ActivePlaybook;
};

/**
 * Bold, always-on-first-load mission nudge: an eye-catching checklist (garden)
 * or family mission list (farm) that auto-opens and can be minimized to a
 * bouncing pill, then re-opened.
 */
export default function PlaybookCoach({
  missions,
  mode,
  busy = false,
  onClaim,
  onNeedPhoto,
  onOpenGarden,
}: {
  missions: CoachMission[];
  /** "garden" shows actionable checklists; "farm" shows a family mission list. */
  mode: "garden" | "farm";
  busy?: boolean;
  onClaim?: (chore: PublicChore) => void | Promise<unknown>;
  onNeedPhoto?: (chore: PublicChore) => void;
  onOpenGarden?: (playerId: string) => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  if (missions.length === 0) return null;

  const first = missions[0];
  const pending = missions.reduce(
    (sum, mission) => sum + Math.max(0, mission.playbook.totalCount - mission.playbook.completedCount),
    0,
  );

  if (minimized) {
    return (
      <button type="button" className="playbook-coach-pill" onClick={() => setMinimized(false)} aria-live="polite">
        <span className="playbook-coach-pill-emoji" aria-hidden="true">{first.playbook.emoji}</span>
        <span className="playbook-coach-pill-label">
          {mode === "garden"
            ? `${pending} to go · ${first.playbook.title}`
            : `${missions.length} mission${missions.length === 1 ? "" : "s"} to finish`}
        </span>
      </button>
    );
  }

  async function handleClaim(chore: PublicChore) {
    if (!onClaim) return;
    if (chore.requiresSelfie) {
      onNeedPhoto?.(chore);
      return;
    }
    setClaimingId(chore.id);
    try {
      await onClaim(chore);
    } finally {
      setClaimingId(null);
    }
  }

  const footerBusy = busy || claimingId !== null;

  return (
    <Sheet
      variant="crate"
      title={mode === "garden" ? first.playbook.title : "Missions!"}
      className="sheet--playbook-coach"
      icon={<span className="playbook-coach-hero" aria-hidden="true">{first.playbook.emoji}</span>}
      onClose={() => setMinimized(true)}
      footer={
        <div className="playbook-coach-foot">
          <button className="btn ghost" type="button" onClick={() => setMinimized(true)}>
            Minimize
          </button>
          {mode === "farm" && first.playerId && first.kidName && (
            <button className="btn gold" type="button" onClick={() => onOpenGarden?.(first.playerId as string)}>
              Open {first.kidName}'s garden
            </button>
          )}
        </div>
      }
    >
      {mode === "garden"
        ? missions.map((mission) => (
            <GardenMission
              key={mission.playbook.id}
              mission={mission}
              busy={footerBusy}
              onClaim={handleClaim}
            />
          ))
        : missions.map((mission) => (
            <FarmMissionCard
              key={`${mission.playerId ?? "farm"}-${mission.playbook.id}`}
              mission={mission}
              onOpenGarden={onOpenGarden}
            />
          ))}
    </Sheet>
  );
}

function GardenMission({
  mission,
  busy,
  onClaim,
}: {
  mission: CoachMission;
  busy: boolean;
  onClaim: (chore: PublicChore) => void;
}) {
  const playbook = mission.playbook;
  const total = playbook.totalCount;
  const done = playbook.completedCount;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <section className="playbook-coach-mission">
      <header className="playbook-coach-mission-head">
        <span className="playbook-coach-mission-emoji" aria-hidden="true">{playbook.emoji}</span>
        <div className="playbook-coach-mission-meta">
          <b className="playbook-coach-mission-title">{playbook.title}</b>
          <span className="playbook-coach-mission-desc">{playbook.description}</span>
          {playbook.windowLabel && <span className="playbook-coach-window">{playbook.windowLabel}</span>}
        </div>
        <span className="playbook-coach-count" role="status">
          {done}/{total}
        </span>
      </header>
      <div className="playbook-coach-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <span className="playbook-coach-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="playbook-coach-list" role="list">
        {playbook.items.map(({ chore }) => {
          const isDone = chore.claimed;
          return (
            <div
              key={chore.id}
              className={isDone ? "playbook-coach-row done" : "playbook-coach-row"}
              role="listitem"
            >
              <span className="playbook-coach-check" aria-hidden="true">{isDone ? "✅" : "⬜"}</span>
              <span className="playbook-coach-chore-emoji" aria-hidden="true">{chore.emoji}</span>
              <span className="playbook-coach-chore-title">{chore.title}</span>
              <span className="job-chip">{kidSeedRewardLabel(chore.rewardSeedCount, chore.rewardSeedKind)}</span>
              {!isDone && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || !chore.eligible}
                  onClick={() => onClaim(chore)}
                >
                  {chore.requiresSelfie ? "Photo" : "Do it"}
                </button>
              )}
              {!isDone && !chore.eligible && chore.reason && (
                <small className="job-reason">{chore.reason}</small>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FarmMissionCard({
  mission,
  onOpenGarden,
}: {
  mission: CoachMission;
  onOpenGarden?: (playerId: string) => void;
}) {
  const playbook = mission.playbook;
  const total = playbook.totalCount;
  const done = playbook.completedCount;
  const remaining = Math.max(0, total - done);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = kidColor(mission.color);
  const praise =
    remaining === 0
      ? "Mission complete! 🎉"
      : remaining === 1
        ? "Last one — you've got this! ⭐"
        : `${remaining} to go. You got this! 🌟`;
  return (
    <section
      className="playbook-coach-mission playbook-coach-mission--farm"
      style={{ background: color.soft, borderColor: color.hex }}
    >
      <header className="playbook-coach-mission-head">
        <KidAvatar
          className="playbook-coach-avatar"
          size="lg"
          name={mission.kidName}
          mascot={mission.mascot ?? "cow"}
          avatarKind={mission.avatarKind}
          avatarPreset={mission.avatarPreset ?? null}
          avatarUrl={mission.avatarUrl ?? null}
          decorative
        />
        <div className="playbook-coach-mission-meta">
          <b className="playbook-coach-mission-title" style={{ color: color.ink }}>
            {mission.kidName}
          </b>
          <span className="playbook-coach-mission-desc">
            {playbook.emoji} {playbook.title}
          </span>
          <span className="playbook-coach-cheer" style={{ color: color.ink }}>
            {praise}
          </span>
        </div>
        <span className="playbook-coach-count" role="status" style={{ color: color.ink }}>
          {done}/{total}
        </span>
      </header>
      <div
        className="playbook-coach-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span className="playbook-coach-fill" style={{ width: `${pct}%`, background: color.hex }} />
      </div>
      {onOpenGarden && mission.playerId && (
        <button
          className="btn gold playbook-coach-go"
          type="button"
          onClick={() => onOpenGarden(mission.playerId as string)}
        >
          Open {mission.kidName ? `${mission.kidName}'s` : "the"} garden →
        </button>
      )}
    </section>
  );
}