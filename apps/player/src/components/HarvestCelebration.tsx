import type { HarvestReward } from "../api";
import Sheet from "./Sheet";

export default function HarvestCelebration({
  reward,
  onClose,
}: {
  reward: HarvestReward;
  onClose: () => void;
}) {
  return (
    <Sheet title="Harvest!" onClose={onClose}>
      <div className="celebrate">
        <div className="burst">✨ ⭐ 🌼 ⭐ ✨</div>
        <div className="hero">{reward.emoji}</div>
        <h2>{reward.name} is in!</h2>
        <p>
          +{reward.points} star{reward.points === 1 ? "" : "s"} and {reward.seedsReturned} seed back in your pouch.
        </p>
        <div className="sheet-actions" style={{ justifyContent: "center" }}>
          <button className="btn gold" type="button" onClick={onClose}>
            Keep gardening
          </button>
        </div>
      </div>
    </Sheet>
  );
}
