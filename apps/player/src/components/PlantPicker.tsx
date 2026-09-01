import { formatDuration, type GameConfig } from "@farmhand/shared";
import Sheet from "./Sheet";

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
      <p>You have 🌱 {seeds} seeds. Bigger plants take longer and earn more stars.</p>
      <div className="tier-grid">
        {config.tiers.map((tier) => {
          const affordable = seeds >= tier.seedCost;
          return (
            <button
              key={tier.tier}
              className={`tier ${affordable ? "" : "disabled"}`}
              type="button"
              disabled={!affordable}
              onClick={() => onPick(tier.tier)}
            >
              <div className="big">{tier.emoji}</div>
              <b>
                T{tier.tier} {tier.name}
              </b>
              <div>🌱 {tier.seedCost}</div>
              <div>⏱ {formatDuration(tier.durationMinutes)}</div>
              <div>⭐ {tier.points}</div>
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
