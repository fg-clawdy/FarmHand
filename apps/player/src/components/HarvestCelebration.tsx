import { cropKindForTier, type CropKind } from "@farmhand/shared";
import type { HarvestReward } from "../api";
import { PlantFigure } from "../art";
import Sheet from "./Sheet";

function cropFromReward(reward: HarvestReward): CropKind {
  if (reward.kind) return reward.kind;
  if (reward.points >= 4) return "cotton";
  if (reward.points >= 2) return "strawberry";
  return cropKindForTier(1);
}

export default function HarvestCelebration({
  reward,
  onClose,
}: {
  reward: HarvestReward;
  onClose: () => void;
}) {
  const kind = cropFromReward(reward);
  return (
    <Sheet title="Harvest!" onClose={onClose}>
      <div className="celebrate">
        <PlantFigure className="hero-art" kind={kind} stage={4} ready />
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
