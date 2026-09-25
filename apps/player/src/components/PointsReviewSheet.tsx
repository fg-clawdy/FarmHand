import { useEffect, useState, type ReactNode } from "react";
import { AcornArt, StarIcon } from "../art";
import { api, type PlayerReview, type ReviewPeriodKey } from "../api";
import Sheet from "./Sheet";

const TABS: { id: ReviewPeriodKey; label: string }[] = [
  { id: "day", label: "Today" },
  { id: "week", label: "Week" },
  { id: "season", label: "Season" },
  { id: "all", label: "All time" },
];

function Stat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="review-stat">
      <div className="review-stat-value">
        <span className="review-stat-icon">{icon}</span>
        <strong>{value}</strong>
      </div>
      <div className="review-stat-label">{label}</div>
    </div>
  );
}

export default function PointsReviewSheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<ReviewPeriodKey>("day");
  const [review, setReview] = useState<PlayerReview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .gardenReview()
      .then(setReview)
      .catch((err: Error) => setError(err.message || "Could not load your review."));
  }, []);

  const period = review?.periods[tab];

  return (
    <Sheet title="Your farm story" className="points-review-sheet" onClose={onClose}>
      <div className="review-tabs" role="tablist" aria-label="Review period">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`review-tab ${tab === t.id ? "on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!review && !error && <p className="picker-intro">Counting your wins…</p>}
      {error && <p className="error">{error}</p>}

      {period && (
        <>
          <p className="picker-intro">
            {period.label}
            {period.rangeLabel ? ` · ${period.rangeLabel}` : ""}
          </p>
          <div className="review-grid">
            <Stat icon={<StarIcon className="inline-art" />} value={period.starsEarned} label="Stars earned" />
            <Stat icon="🌾" value={period.harvests} label="Plants harvested" />
            <Stat
              icon={<AcornArt className="inline-art" />}
              value={period.freeSeeds}
              label="Free seeds earned"
            />
            <Stat icon="🌱" value={period.plantings} label="Seeds planted" />
            <Stat icon="💧" value={period.waterings} label="Waterings" />
            <Stat icon="✅" value={period.choresDone} label="Chores finished" />
            <Stat icon="📸" value={period.selfies} label="Selfies" />
            <Stat icon="🏅" value={period.badges} label="Badges unlocked" />
            {tab !== "day" && (
              <Stat icon="📅" value={period.daysPlayed} label="Days you played" />
            )}
          </div>
          {period.starsEarned === 0 && period.harvests === 0 && period.choresDone === 0 && (
            <p className="muted review-empty">
              {tab === "day"
                ? "Nothing logged yet today — plant, water, or finish a chore!"
                : "No wins in this window yet. Keep farming!"}
            </p>
          )}
        </>
      )}

      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
