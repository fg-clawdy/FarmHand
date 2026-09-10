import { MASCOT_EMOJI, type Mascot } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function ActivityPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.activity>> | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof api.audit>>["logs"]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.activity(), api.audit()])
      .then(([activity, auditData]) => {
        setData(activity);
        setAudit(auditData.logs);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Leafing through the ledger…</p>;

  return (
    <div>
      <h1>Last 7 days</h1>
      <p className="muted">Days counted in {data.timezone}.</p>
      {data.activity.map((row) => (
        <div className="card" key={row.playerId} style={{ marginBottom: 12 }}>
          <h2>
            {MASCOT_EMOJI[row.mascot as Mascot] ?? ""} {row.name}
          </h2>
          <p>
            Totals: {row.totals.logins} logins · {row.totals.waterings} waterings · {row.totals.harvests} harvests ·{" "}
            {row.totals.points} stars
          </p>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Logins</th>
                <th>Waterings</th>
                <th>Harvests</th>
                <th>Stars</th>
              </tr>
            </thead>
            <tbody>
              {row.days.map((day) => (
                <tr key={day.day}>
                  <td>{day.day}</td>
                  <td>{day.logins}</td>
                  <td>{day.waterings}</td>
                  <td>{day.harvests}</td>
                  <td>{day.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h2>Audit log</h2>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Player</th>
          </tr>
        </thead>
        <tbody>
          {audit.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.admin}</td>
              <td>{log.action}</td>
              <td>{log.player}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
