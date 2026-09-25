import { formatCountdown, type PublicPlot } from "@farmhand/shared";
import type { GardenPlayer } from "../api";
import { PlantFigure, plantKind } from "../art";
import Sheet from "./Sheet";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function waterStatus(plot: PublicPlot) {
  if (plot.ready) return "Ready — no water needed";
  if ((plot.waterCooldownRemainingMs ?? 0) > 0) {
    return `Water again in ${formatCountdown(plot.waterCooldownRemainingMs ?? 0)}`;
  }
  if ((plot.watersLeftToday ?? 0) <= 0) return "Daily water cap reached";
  if (plot.canWater) return "Waterable now";
  return "Not waterable right now";
}

/** Cream chip copy under the plant art (high-contrast, dark on cream). */
export function growthStatus(plot: PublicPlot) {
  if (plot.state === "wilted") return "Wilted — prune to free the plot";
  if (plot.ready && plot.awaitingApproval) return "Ready — waiting on a grown-up";
  if (plot.ready) return "Ready to harvest";
  if (plot.awaitingApproval) {
    return `Growing · ${formatCountdown(plot.remainingMs)} · waiting on approval`;
  }
  return `Matures in ${formatCountdown(plot.remainingMs)}`;
}

export type PlotStatusPill = {
  label: string;
  tone: "growing" | "ready" | "waiting" | "wilted";
};

/** Header status pill beside the crop title. */
export function plotStatusPill(plot: PublicPlot): PlotStatusPill {
  if (plot.state === "wilted") return { label: "Wilted", tone: "wilted" };
  if (plot.awaitingApproval) return { label: "Waiting on grown-up", tone: "waiting" };
  if (plot.ready) return { label: "Ready", tone: "ready" };
  return { label: "Growing", tone: "growing" };
}

export default function PlotSheet({
  plot,
  cropName,
  player,
  onWater,
  onPrune,
  onClose,
  onNeedSelfie,
  onNotifyParent,
  selfieUnlocked,
  busy,
  notifyBusy,
}: {
  plot: PublicPlot;
  cropName: string;
  player?: GardenPlayer;
  onWater: () => void;
  onPrune?: () => void;
  onClose: () => void;
  onNeedSelfie: () => void;
  onNotifyParent?: () => void;
  selfieUnlocked: boolean;
  busy: boolean;
  notifyBusy?: boolean;
}) {
  const kind = plantKind(plot);
  const title = plot.cropName || cropName || "Plant";
  const awaiting = Boolean(plot.awaitingApproval);
  const wilted = plot.state === "wilted";
  const notify = player?.notifyParent;
  const canNotify = Boolean(onNotifyParent && awaiting && notify?.allowed !== false);
  const notifyRetry = notify?.retryAt ? formatWhen(notify.retryAt) : null;
  const pill = plotStatusPill(plot);

  return (
    <Sheet
      title={title}
      titleExtra={
        <span className={`plot-status-pill plot-status-pill--${pill.tone}`}>{pill.label}</span>
      }
      className={`plot-sheet${awaiting ? " plot-sheet--awaiting" : ""}`}
      onClose={onClose}
    >
      <div className="plot-layout">
        <div className={`plot-hero ${wilted ? "greyed" : ""} ${awaiting ? "awaiting-approval" : ""}`}>
          {kind && (
            <PlantFigure className="hero-art" kind={kind} stage={plot.growthStage ?? 1} ready={plot.ready} />
          )}
          <p className="plot-status-chip">{growthStatus(plot)}</p>
        </div>

        <div className="plot-side">
          <dl className="plot-details">
            <div>
              <dt>Planted</dt>
              <dd>{formatWhen(plot.plantedAt)}</dd>
            </div>
            <div>
              <dt>Seeds used</dt>
              <dd>{plot.seedCost ?? "—"}</dd>
            </div>
            <div>
              <dt>Stars on harvest</dt>
              <dd>{plot.harvestPoints ?? "—"}</dd>
            </div>
            <div>
              <dt>Growth</dt>
              <dd>
                {plot.growthStage ? `Stage ${plot.growthStage}` : "—"}
                {plot.ready ? " · ready" : ""}
              </dd>
            </div>
            <div>
              <dt>Water</dt>
              <dd>
                {waterStatus(plot)}
                {plot.watersLeftToday != null && !plot.ready ? ` · ${plot.watersLeftToday} left today` : ""}
              </dd>
            </div>
            <div>
              <dt>Last watered</dt>
              <dd>{formatWhen(plot.lastWateredAt)}</dd>
            </div>
          </dl>

          {awaiting && (
            <>
              <div className="plot-side-divider" role="presentation" />
              <div className="plot-approval">
                <h3>
                  <span className="plot-approval-dot" aria-hidden="true" />
                  Needs grown-up approval
                </h3>
                <ul>
                  {(plot.pendingChores ?? []).map((chore) => (
                    <li key={chore.claimId}>
                      <span className="pending-emoji">{chore.emoji}</span>
                      <span>
                        {chore.title}
                        {chore.seedsUsed > 1 ? ` (${chore.seedsUsed} seeds)` : ""}
                      </span>
                      <span className="pending-when">{formatWhen(chore.claimedAt)}</span>
                    </li>
                  ))}
                </ul>
                {onNotifyParent && (
                  <button
                    className="btn remind"
                    type="button"
                    disabled={!canNotify || busy || notifyBusy}
                    onClick={() => onNotifyParent()}
                  >
                    {canNotify
                      ? "Remind grown-up"
                      : notifyRetry
                        ? `Remind again after ${notifyRetry}`
                        : "Remind grown-up"}
                  </button>
                )}
                {!canNotify && notifyRetry && (
                  <p className="hint">You can nudge a grown-up once per hour.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`sheet-actions ${busy ? "busy" : ""}`}>
        {wilted && onPrune ? (
          <button className="btn stamp" type="button" onClick={onPrune}>
            Prune
          </button>
        ) : !wilted && !plot.ready ? (
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
        ) : null}
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
