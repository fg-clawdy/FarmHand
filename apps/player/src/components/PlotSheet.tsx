import { formatCountdown, type PublicPlot } from "@farmhand/shared";
import type { GardenPlayer } from "../api";
import { PlantFigure, plantKind } from "../art";
import Sheet from "./Sheet";

export default function PlotSheet({
  plot,
  cropName,
  player,
  onWater,
  onFertilize,
  onClose,
  onNeedSelfie,
  selfieUnlocked,
  busy,
}: {
  plot: PublicPlot;
  cropName: string;
  player: GardenPlayer;
  onWater: () => void;
  onFertilize: () => void;
  onClose: () => void;
  onNeedSelfie: () => void;
  selfieUnlocked: boolean;
  busy: boolean;
}) {
  const kind = plantKind(plot);
  const title = cropName || "Plant";
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="plot-hero">
        {kind && (
          <PlantFigure className="hero-art" kind={kind} stage={plot.growthStage ?? 4} ready={plot.ready} />
        )}
        <p className="plot-time">Matures in {formatCountdown(plot.remainingMs)}</p>
      </div>
      <div className={`sheet-actions ${busy ? "busy" : ""}`}>
        <button
          className="btn water"
          type="button"
          disabled={selfieUnlocked && !plot.canWater}
          onClick={() => {
            if (!selfieUnlocked) {
              onNeedSelfie();
              return;
            }
            onWater();
          }}
        >
          {selfieUnlocked ? "Water (−1h)" : "Take today's selfie to water"}
        </button>
        <button className="btn primary" type="button" disabled={player.fertilizer < 1} onClick={onFertilize}>
          Fertilize
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
