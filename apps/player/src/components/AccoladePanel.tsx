import { useEffect, useState } from "react";
import { api, type AccoladeLedger } from "../api";
import BadgeInfoModal, { type SelectedBadge } from "./BadgeInfoModal";
import { BadgePatch, type BadgePatchState } from "./BadgePatch";
import Sheet from "./Sheet";

export function AccoladeLedgerBody({ ledger }: { ledger: AccoladeLedger }) {
  const [selected, setSelected] = useState<SelectedBadge | null>(null);

  return (
    <div className="badge-ledger">
      <p className="badge-season">This season · {ledger.seasonLabel}</p>
      <div className="badge-cards">
        {ledger.seasonal.tracks.map((track) => {
          const complete = track.next.done;
          const pct = complete
            ? 100
            : track.next.at
              ? Math.min(100, (track.count / track.next.at) * 100)
              : 0;
          const patchState: BadgePatchState = complete ? "complete" : track.count > 0 ? "progress" : "locked";
          return (
            <button
              key={track.slug}
              type="button"
              className={complete ? "badge-card badge-card--complete" : "badge-card"}
              onClick={() => setSelected({ kind: "seasonal", track })}
            >
              <div className="badge-card-fill" style={{ width: `${pct}%` }} />
              <div className="badge-card-body">
                <BadgePatch slug={track.slug} emoji={track.emoji} state={patchState} size={56} />
                <span className="badge-card-name">{track.title}</span>
              </div>
            </button>
          );
        })}
      </div>
      <h3>Forever legends</h3>
      <div className="badge-cards">
        {ledger.lifetime.legends.map((legend) => {
          const pct = legend.earned ? 100 : legend.at ? Math.min(100, (legend.count / legend.at) * 100) : 0;
          const patchState: BadgePatchState = legend.earned ? "complete" : legend.count > 0 ? "progress" : "locked";
          return (
            <button
              key={legend.slug}
              type="button"
              className={legend.earned ? "badge-card badge-card--complete" : "badge-card"}
              onClick={() => setSelected({ kind: "lifetime", legend })}
            >
              <div className="badge-card-fill" style={{ width: `${pct}%` }} />
              <div className="badge-card-body">
                <BadgePatch slug={legend.slug} emoji={legend.emoji} state={patchState} size={56} />
                <span className="badge-card-name">{legend.title}</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="badge-footnote">Badges do not give extra stars or seeds.</p>
      {selected && (
        <BadgeInfoModal selected={selected} seasonLabel={ledger.seasonLabel} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default function AccoladePanel({
  onClose,
  ledger,
}: {
  onClose: () => void;
  ledger?: AccoladeLedger | null;
}) {
  const [loaded, setLoaded] = useState<AccoladeLedger | null>(ledger ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ledger) {
      setLoaded(ledger);
      return;
    }
    void api
      .accolades()
      .then(setLoaded)
      .catch((err: Error) => setError(err.message));
  }, [ledger]);

  return (
    <Sheet title="Badges" onClose={onClose}>
      {!loaded && !error && <p>Looking in the trophy case…</p>}
      {error && <p className="error">{error}</p>}
      {loaded && <AccoladeLedgerBody ledger={loaded} />}
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Back to garden
        </button>
      </div>
    </Sheet>
  );
}
