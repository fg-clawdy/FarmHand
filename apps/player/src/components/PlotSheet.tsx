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
  onPrune,
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
  onPrune?: () => void;
  onClose: () => void;
  onNeedSelfie: () => void;
  selfieUnlocked: boolean;
  busy: boolean;
}) {
  const kind = plantKind(plot);
  const title = cropName || "Plant";
  const waiting = plot.state === "purgatory";
  const wilted = plot.state === "wilted";
  return (
    <Sheet title={waiting ? "Waiting" : wilted ? "Wilted" : title} onClose={onClose}>
      <div className={`plot-hero ${waiting || wilted ? "greyed" : ""}`}>
        {kind && (
          <PlantFigure className="hero-art" kind={kind} stage={plot.growthStage ?? 1} ready={plot.ready} />
        )}
        {waiting && <p className="plot-time">Waiting for a grown-up to check this chore.</p>}
        {wilted && <p className="plot-time">This plant wilted. Prune it to free the plot. You don't get the seed back.</p>}
        {!waiting && !wilted && <p className="plot-time">Matures in {formatCountdown(plot.remainingMs)}</p>}
      </div>
      <div className={`sheet-actions ${busy ? "busy" : ""}`}>
        {wilted && onPrune ? (
          <button className="btn stamp" type="button" onClick={onPrune}>
            Prune
          </button>
        ) : waiting ? (
          <button className="btn ghost" type="button" onClick={onClose}>
            Okay
          </button>
        ) : (
          <>
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
          </>
        )}
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
