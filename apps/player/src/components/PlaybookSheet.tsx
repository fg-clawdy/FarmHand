import type { ActivePlaybook, PublicChore } from "../api";
import { kidSeedRewardLabel } from "../kidSeedReward";
import Sheet from "./Sheet";

export default function PlaybookSheet({
  playbook,
  busy,
  onClose,
  onClaim,
  onNeedPhoto,
}: {
  playbook: ActivePlaybook;
  busy: boolean;
  onClose: () => void;
  onClaim: (chore: PublicChore) => Promise<unknown>;
  onNeedPhoto: (chore: PublicChore) => void;
}) {
  const done = playbook.items.filter((item) => item.claimed).length;
  const total = playbook.totalCount;

  async function claim(chore: PublicChore) {
    if (chore.requiresSelfie) {
      onNeedPhoto(chore);
      return;
    }
    await onClaim(chore);
  }

  return (
    <Sheet title={playbook.title} onClose={onClose} className="sheet--playbook">
      <p className="muted">
        {playbook.emoji} {playbook.description}
      </p>
      <p className="muted" role="status">
        {done}/{total} done {playbook.windowLabel ? `· ${playbook.windowLabel}` : ""}
      </p>
      {playbook.allDone && (
        <p className="playbook-complete-banner">🎉 Mission complete!</p>
      )}
      <div className="playbook-list" role="list">
        {playbook.items.map(({ chore }) => {
          const isDone = chore.claimed;
          return (
            <div key={chore.id} className={`playbook-row ${isDone ? "done" : ""}`} role="listitem">
              <span className="playbook-check">{isDone ? "✅" : "⬜"}</span>
              <span className="playbook-emoji">{chore.emoji}</span>
              <span className="playbook-title">{chore.title}</span>
              <span className="job-chip">{kidSeedRewardLabel(chore.rewardSeedCount, chore.rewardSeedKind)}</span>
              {!isDone && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || !chore.eligible}
                  onClick={() => void claim(chore)}
                >
                  {chore.requiresSelfie ? "Photo" : "Do it"}
                </button>
              )}
              {!isDone && !chore.eligible && <small className="job-reason">{chore.reason}</small>}
            </div>
          );
        })}
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Back to board
        </button>
      </div>
    </Sheet>
  );
}
