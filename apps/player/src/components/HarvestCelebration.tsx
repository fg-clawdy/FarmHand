import type { HarvestReward } from "../api";
import { PlantFigure } from "../art";
import Sheet from "./Sheet";

export default function HarvestCelebration({
  reward,
  onClose,
}: {
  reward: HarvestReward;
  onClose: () => void;
}) {
  const kind = reward.points >= 8 ? "oak" : reward.points >= 4 ? "sunflower" : reward.points >= 2 ? "herbs" : "daisy";
  return (
    <Sheet title="Harvest!" onClose={onClose}>
      <div className="celebrate">
        <PlantFigure className="hero-art" kind={kind} ready />
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
