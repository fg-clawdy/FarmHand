import { formatDuration, type GameConfig } from "@farmhand/shared";
import { AcornArt, ClockIcon, PlantFigure, StarIcon } from "../art";
import Sheet from "./Sheet";

const TIER_KIND = ["daisy", "herbs", "sunflower", "oak"] as const;

export default function PlantPicker({
  config,
  seeds,
  onPick,
  onClose,
}: {
  config: GameConfig;
  seeds: number;
  onPick: (tier: number) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Choose a plant" onClose={onClose}>
      <p className="picker-intro">
        You have <AcornArt className="inline-art" /> {seeds} seeds. Bigger plants take longer and earn more stars.
      </p>
      <div className="tier-grid">
        {config.tiers.map((tier) => {
          const affordable = seeds >= tier.seedCost;
          const kind = TIER_KIND[tier.tier - 1] ?? "daisy";
          return (
            <button
              key={tier.tier}
              className={`tier ${affordable ? "" : "disabled"}`}
              type="button"
              disabled={!affordable}
              onClick={() => onPick(tier.tier)}
            >
              <PlantFigure className="tier-art" kind={kind} ready />
              <b>
                T{tier.tier} {tier.name}
              </b>
              <div className="inline-row">
                <AcornArt className="inline-art" /> {tier.seedCost}
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
