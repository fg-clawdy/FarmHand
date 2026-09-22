import type { GameConfig } from "@farmhand/shared";
import type { HarvestReward } from "../api";

/** Non-modal harvest payoff: stars, seeds, and shard deltas. Auto-dismissed by the parent. */
export default function HarvestCelebration({ reward, config }: { reward: HarvestReward; config: GameConfig }) {
  const stars = reward.points;
  const seeds = reward.seedsFromShards ?? 0;
  const shards = reward.shardsEarned ?? 0;
  const remainingShards = reward.remainingShards ?? 0;
  return (
    <div className="harvest-banner" role="status" aria-live="polite">
      <div className="harvest-banner-title">{reward.emoji} {reward.name}!</div>
      <div className="harvest-banner-deltas">
        {stars > 0 && <span className="harvest-delta stars">+{stars} ★</span>}
        {seeds > 0 && <span className="harvest-delta seeds">+{seeds} seed{seeds === 1 ? "" : "s"}</span>}
        {shards > 0 && (
          <span className="harvest-delta shards">
            +{shards} shard{shards === 1 ? "" : "s"}
            <span className="shard-progress"> ({remainingShards}/{config.shardsPerSeed} toward next seed)</span>
          </span>
        )}
      </div>
    </div>
  );
}
