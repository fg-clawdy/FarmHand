import { cropKindForTier, formatDuration, type GameConfig } from "@farmhand/shared";
import { AcornArt, ClockIcon, PlantFigure, StarIcon } from "../art";
import Sheet from "./Sheet";

export default function PlantPicker({
  config,
  seeds,
  onPick,
  onClose,
  title = "Choose a plant",
  intro,
  free = false,
}: {
  config: GameConfig;
  seeds: number;
  onPick: (tier: number) => void;
  onClose: () => void;
  title?: string;
  intro?: string;
  /** Chore claims inject a seed — don't check the pouch. */
  free?: boolean;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="picker-intro">
        {intro ?? (
          <>
            You have <AcornArt className="inline-art" /> {seeds} seeds. Bigger plants take longer and earn more stars.
          </>
        )}
      </p>
      <div className="tier-grid">
        {config.tiers.map((tier) => {
          const affordable = free || seeds >= tier.seedCost;
          const kind = tier.kind ?? cropKindForTier(tier.tier);
          return (
            <button
              key={tier.tier}
              className={`tier ${affordable ? "" : "disabled"}`}
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
