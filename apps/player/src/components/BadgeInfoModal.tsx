import { CROP_EXPLORER_STEPS, MEDAL_STEPS, type AccoladeMedal } from "@farmhand/shared";
import type { AccoladeLedger } from "../api";
import { BadgePatch, type BadgePatchState } from "./BadgePatch";

export type SelectedBadge =
  | { kind: "seasonal"; track: AccoladeLedger["seasonal"]["tracks"][number] }
  | { kind: "lifetime"; legend: AccoladeLedger["lifetime"]["legends"][number] };

function medalGlyph(medal: AccoladeMedal) {
  if (medal === "bronze") return "🥉";
  if (medal === "silver") return "🥈";
  return "🥇";
}

export default function BadgeInfoModal({
  selected,
  seasonLabel,
  onClose,
}: {
  selected: SelectedBadge;
  seasonLabel: string;
  onClose: () => void;
}) {
  const isSeasonal = selected.kind === "seasonal";
  const title = isSeasonal ? selected.track.title : selected.legend.title;
  const emoji = isSeasonal ? selected.track.emoji : selected.legend.emoji;
  const blurb = isSeasonal ? selected.track.blurb : selected.legend.blurb;
  const count = isSeasonal ? selected.track.count : selected.legend.count;
  const complete = isSeasonal ? selected.track.next.done : selected.legend.earned;
  const patchState: BadgePatchState = complete ? "complete" : count > 0 ? "progress" : "locked";
  const steps = isSeasonal ? (selected.track.slug === "crops" ? CROP_EXPLORER_STEPS : MEDAL_STEPS) : null;
  const earnedMedals = isSeasonal ? selected.track.medals : [];

  return (
    <div className="badge-modal-backdrop" onClick={onClose} role="presentation">
      <div className="badge-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <button className="badge-modal-close" type="button" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <BadgePatch slug={isSeasonal ? selected.track.slug : selected.legend.slug} emoji={emoji} state={patchState} size={96} />
        <h3 className="badge-modal-title">{title}</h3>
        <p className="badge-modal-kind">{isSeasonal ? `This season · ${seasonLabel}` : "Forever legend"}</p>
        <p className="badge-modal-blurb">{blurb}</p>

        {isSeasonal && steps && (
          <div className="badge-modal-ladder">
            {steps.map((step) => {
              const earned = earnedMedals.includes(step.medal);
              return (
                <div key={step.medal} className={earned ? "badge-ladder-row badge-ladder-row--earned" : "badge-ladder-row"}>
                  <span className="badge-ladder-medal">{medalGlyph(step.medal)}</span>
                  <span className="badge-ladder-label">{step.medal[0].toUpperCase() + step.medal.slice(1)}</span>
                  <span className="badge-ladder-at">{step.at}</span>
                  <span className="badge-ladder-check">{earned ? "✓" : ""}</span>
                </div>
              );
            })}
            <p className="badge-modal-stat">
              Current count: <strong>{count}</strong>
              {!complete && selected.kind === "seasonal" && selected.track.next.medal
                ? ` · ${selected.track.next.remaining} more to ${selected.track.next.medal}`
                : ""}
            </p>
          </div>
        )}

        {!isSeasonal && (
          <div className="badge-modal-ladder">
            <p className="badge-modal-stat">
              Progress: <strong>{count}</strong> / {selected.legend.at}
            </p>
            {!complete && <p className="badge-modal-stat">{selected.legend.remaining} more to go</p>}
            {complete && <p className="badge-modal-stat badge-modal-stat--complete">🏆 Earned forever!</p>}
          </div>
        )}

        <button className="btn ghost badge-modal-back" type="button" onClick={onClose}>
          Back to badges
        </button>
      </div>
    </div>
  );
}
