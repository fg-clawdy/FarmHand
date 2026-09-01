import type { HarvestReward } from "../api";
import { plantArt } from "../art";
import Sheet from "./Sheet";

export default function HarvestCelebration({
  reward,
  onClose,
}: {
  reward: HarvestReward;
  onClose: () => void;
}) {
  const src = plantArt({ state: "mature", tier: reward.points >= 8 ? 4 : reward.points >= 4 ? 3 : reward.points >= 2 ? 2 : 1, growthStage: 4, ready: true });
  return (
    <Sheet title="Harvest!" onClose={onClose}>
      <div className="celebrate">
        {src && <img className="hero-art" src={src} alt="" />}
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
