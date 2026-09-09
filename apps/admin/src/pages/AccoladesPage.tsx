import { MASCOT_EMOJI, type Mascot } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api } from "../api";

function medalGlyph(medal: string | null) {
  if (medal === "bronze") return "🥉";
  if (medal === "silver") return "🥈";
  if (medal === "gold") return "🥇";
  return "·";
}

export default function AccoladesPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.accolades>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .accolades()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Opening the trophy case…</p>;

  return (
    <div>
      <h1>Accolades</h1>
      <p className="muted">
        Same kid ledger as the garden badges and Parent Kids tab. Season {data.seasonLabel} in {data.timezone}.
        Badges do not grant stars or seeds.
      </p>
      {data.kids.map((kid) => (
        <article className="card" key={kid.id} style={{ marginBottom: 12 }}>
          <h2>
            {MASCOT_EMOJI[kid.mascot as Mascot] ?? ""} {kid.name}
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Seasonal medals this quarter
          </p>
          <table>
            <thead>
              <tr>
                <th>Track</th>
                <th>Count</th>
                <th>Medals</th>
                <th>Next</th>
              </tr>
            </thead>
            <tbody>
              {kid.seasonal.tracks.map((track) => (
                <tr key={track.slug}>
                  <td>
                    {track.emoji} {track.title}
                  </td>
                  <td>{track.count}</td>
                  <td>{track.medals.length ? track.medals.map(medalGlyph).join(" ") : "—"}</td>
                  <td>
                    {track.next.done ? "Gold" : `${track.next.remaining} to ${track.next.medal}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Lifetime legends</h3>
          <ul className="accolade-legends">
            {kid.lifetime.legends.map((legend) => (
              <li key={legend.slug} className={legend.earned ? "earned" : ""}>
                <span>
                  {legend.emoji} {legend.title}
                </span>
                <span className="muted">
                  {legend.earned ? "earned" : `${legend.count} / ${legend.at}`}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
