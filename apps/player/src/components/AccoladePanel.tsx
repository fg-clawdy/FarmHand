import { useEffect, useState } from "react";
import { api, type AccoladeLedger } from "../api";
import Sheet from "./Sheet";

function medalGlyph(medal: string | null) {
  if (medal === "bronze") return "🥉";
  if (medal === "silver") return "🥈";
  if (medal === "gold") return "🥇";
  return "";
}

export function AccoladeLedgerBody({ ledger }: { ledger: AccoladeLedger }) {
  return (
    <div className="badge-ledger">
      <p className="sheet-status badge-season">This season · {ledger.seasonLabel}</p>
      <div className="badge-tracks">
        {ledger.seasonal.tracks.map((track) => (
          <div key={track.slug} className="badge-track parchment">
            <div className="badge-track-head">
              <span className="badge-emoji">{track.emoji}</span>
              <div>
                <strong>{track.title}</strong>
                <p className="badge-medals">
                  {track.medals.length ? track.medals.map((medal) => medalGlyph(medal)).join(" ") : "No medal yet"}
                </p>
              </div>
              <span className="badge-count">{track.count}</span>
            </div>
            <div className="badge-bar">
              <div
                style={{
                  width: `${Math.min(100, track.next.at ? (track.count / track.next.at) * 100 : 100)}%`,
                }}
              />
            </div>
            <p className="badge-blurb">{track.blurb}</p>
            <p className="badge-next">
              {track.next.done ? "Gold this season!" : `${track.next.remaining} more to ${track.next.medal}`}
            </p>
          </div>
        ))}
      </div>
      <h3 className="sheet-kicker">Forever legends</h3>
      <ul className="legend-list">
        {ledger.lifetime.legends.map((legend) => (
          <li key={legend.slug} className={legend.earned ? "earned parchment" : "parchment"}>
            <span>{legend.emoji}</span>
            <div>
              <strong>{legend.title}</strong>
              <p>
                {legend.earned ? "Earned forever" : `${legend.count} / ${legend.at} · ${legend.remaining} to go`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="sheet-status">Badges do not give extra stars or seeds.</p>
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
      {!loaded && !error && <p className="sheet-lede">Looking in the trophy case…</p>}
      {error && <p className="sheet-error">{error}</p>}
      {loaded && <AccoladeLedgerBody ledger={loaded} />}
      <div className="sheet-actions">
        <button className="btn ghost" type="button" onClick={onClose}>
          Back to garden
        </button>
      </div>
    </Sheet>
  );
}
