import type { HarvestReward } from "../api";

/** Non-modal harvest payoff: big deltas from the API reward. Auto-dismissed by the parent. */
export default function HarvestCelebration({ reward }: { reward: HarvestReward }) {
  const stars = reward.points;
  const seeds = reward.seedsReturned;
  return (
    <div className="harvest-banner" role="status" aria-live="polite">
      <div className="harvest-banner-title">{reward.emoji} {reward.name}!</div>
      <div className="harvest-banner-deltas">
        {stars > 0 && <span className="harvest-delta stars">+{stars} ★</span>}
        {seeds > 0 && <span className="harvest-delta seeds">+{seeds} seed{seeds === 1 ? "" : "s"}</span>}
      </div>
    </div>
  );
}
