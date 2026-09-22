import { cropKindForTier, formatDuration, type GameConfig } from "@farmhand/shared";
import { AcornArt, ClockIcon, PlantFigure, StarIcon } from "../art";
import { cheapestSeedCost } from "../pixi/gardenLayout";
import Sheet from "./Sheet";

export default function PlantPicker({
  config,
  seeds,
  provisionalSeeds = 0,
  onPick,
  onClose,
  onNeedJobs,
  title = "Choose a plant",
  intro,
  free = false,
}: {
  config: GameConfig;
  seeds: number;
  provisionalSeeds?: number;
  onPick: (tier: number) => void;
  onClose: () => void;
  onNeedJobs?: () => void;
  title?: string;
  intro?: string;
  /** Chore claims inject a seed — don't check the pouch. */
  free?: boolean;
}) {
  const totalSeeds = seeds + provisionalSeeds;
  const broke = !free && totalSeeds < cheapestSeedCost(config.tiers);
  const affordableTiers = config.tiers.filter((tier) => free || totalSeeds >= tier.seedCost);
  const recommendedTier =
    affordableTiers.length === 0
      ? null
      : affordableTiers.reduce((best, tier) =>
          tier.seedCost > best.seedCost || (tier.seedCost === best.seedCost && tier.tier > best.tier)
            ? tier
            : best,
        ).tier;

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="picker-intro">
        {broke
          ? "Your seed pouch is empty. Do a job on the Job Board to plant a waiting seed — jobs do not spend pouch seeds."
          : (intro ?? (
              <>
                You have <AcornArt className="inline-art" /> {totalSeeds} seeds
                {provisionalSeeds > 0 && <span className="provisional-note"> ({provisionalSeeds} waiting approval)</span>}
                . Bigger plants cost more seeds and earn more stars.
              </>
            ))}
      </p>
      {broke && onNeedJobs && (
        <div className="sheet-actions">
          <button className="btn gold" type="button" onClick={onNeedJobs}>
            Do a job to plant a waiting seed
          </button>
        </div>
      )}
      <div className="tier-grid">
        {config.tiers.map((tier) => {
          const affordable = free || totalSeeds >= tier.seedCost;
          const kind = tier.kind ?? cropKindForTier(tier.tier);
          const recommended = affordable && tier.tier === recommendedTier;
          return (
            <button
              key={tier.tier}
              className={`tier ${affordable ? "" : "disabled"}${recommended ? " tier-recommended" : ""}`}
              type="button"
              disabled={!affordable}
              onClick={() => onPick(tier.tier)}
            >
              <PlantFigure className="tier-art" kind={kind} stage={4} ready />
              <b>{tier.name}</b>
              <div className="inline-row">
                <AcornArt className="inline-art" /> {free ? "chore seed" : tier.seedCost}
              </div>
              <div className="inline-row">
                <ClockIcon className="inline-art" /> {formatDuration(tier.durationMinutes)}
              </div>
              <div className="inline-row">
                <StarIcon className="inline-art" /> {tier.points}
              </div>
            </button>
          );
        })}
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
