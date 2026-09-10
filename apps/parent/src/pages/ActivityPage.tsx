import { useEffect, useState } from "react";
import { api, type KidAccolades, type KidActivity, type ParentKid, type ParentStats } from "../api";

function pct(n: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((n / max) * 100);
}

function dayLabel(day: string, index: number, total: number): string {
  if (total > 10) return index % 5 === 0 || index === total - 1 ? day.slice(5) : "";
  return day.slice(5);
}

function medalGlyph(medal: string | null) {
  if (medal === "bronze") return "🥉";
  if (medal === "silver") return "🥈";
  if (medal === "gold") return "🥇";
  return "";
}

function KidCard({
  kid,
  badges,
  overview,
}: {
  kid: KidActivity;
  badges?: KidAccolades;
  overview?: ParentKid;
}) {
  const max = Math.max(kid.claims, kid.approvals, kid.denials, 1);
  const sparkMax = Math.max(1, ...kid.series.map((row) => row.claims));
  return (
    <article className="card">
      <h3 style={{ marginTop: 0 }}>
        {kid.name}
        {kid.streak > 0 && (
          <em className="badge" style={{ background: "var(--sage)" }}>
            {kid.streak}-day streak
          </em>
        )}
      </h3>
      <p className="muted" style={{ marginTop: 0 }}>
        {kid.claims} claimed · {kid.approvals} approved · {kid.denials} denied
      </p>
      {overview?.wallet && (
        <p className="muted">
          {overview.wallet.availableStars}★ ready
          {overview.wallet.heldStars > 0 ? ` · ${overview.wallet.heldStars}★ waiting` : ""}
          {" · "}
          {overview.wallet.lifetimeEarned}★ earned all time
          {overview.wallet.lifetimeSpent > 0 ? ` · ${overview.wallet.lifetimeSpent}★ spent` : ""}
        </p>
      )}
      {overview?.rewards && (
        <ul className="chore-break">
          {overview.rewards.pending.map((row) => (
            <li key={row.id}>
              <span>
                {row.emoji} {row.title}
              </span>
              <span className="muted">waiting</span>
            </li>
          ))}
          {overview.rewards.owned.map((row) => (
            <li key={row.id}>
              <span>
                {row.emoji} {row.title}
              </span>
              <span className="muted">owned</span>
            </li>
          ))}
          {overview.rewards.redeemed.slice(0, 4).map((row) => (
            <li key={row.id}>
              <span>
                {row.emoji} {row.title}
              </span>
              <span className="muted">used</span>
            </li>
          ))}
        </ul>
      )}
      <div className="bars">
        <Bar label="Claimed" value={kid.claims} width={pct(kid.claims, max)} kind="claims" />
        <Bar label="Approved" value={kid.approvals} width={pct(kid.approvals, max)} kind="ok" />
        <Bar label="Denied" value={kid.denials} width={pct(kid.denials, max)} kind="no" />
      </div>
      <div className="spark" aria-hidden="true">
        {kid.series.map((row, index) => (
          <div key={row.day} className="spark-col" title={`${row.day}: ${row.claims} claimed`}>
            <div className="spark-grow">
              <div className="spark-bar" style={{ height: `${pct(row.claims, sparkMax)}%` }} />
            </div>
            <span>{dayLabel(row.day, index, kid.series.length)}</span>
          </div>
        ))}
      </div>
      {kid.chores.length > 0 && (
        <ul className="chore-break">
          {kid.chores.map((chore) => (
            <li key={chore.choreId}>
              <span>
                {chore.emoji} {chore.title}
              </span>
              <span className="muted">
                {chore.approvals} ok / {chore.claims} claimed
              </span>
            </li>
          ))}
        </ul>
      )}
      {kid.chores.length === 0 && <p className="muted">No chores claimed in this window.</p>}
      {badges && (
        <div className="kid-badges">
          <h4>Badges · {badges.seasonLabel}</h4>
          <p className="muted" style={{ marginTop: 0 }}>
            Same ledger as the kid garden. No extra stars or seeds.
          </p>
          <ul className="accolade-tracks">
            {badges.seasonal.tracks.map((track) => (
              <li key={track.slug}>
                <span>
                  {track.emoji} {track.title}
                </span>
                <span>
                  {track.medals.length ? track.medals.map(medalGlyph).join(" ") : "—"}
                  <em className="muted"> {track.count}</em>
                </span>
              </li>
            ))}
          </ul>
          <ul className="accolade-legends">
            {badges.lifetime.legends.map((legend) => (
              <li key={legend.slug} className={legend.earned ? "earned" : ""}>
                <span>
                  {legend.emoji} {legend.title}
                </span>
                <span className="muted">{legend.earned ? "earned forever" : `${legend.count} / ${legend.at}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function Bar({
  label,
  value,
  width,
  kind,
}: {
  label: string;
  value: number;
  width: number;
  kind: "claims" | "ok" | "no";
}) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className={`bar-fill ${kind}`} style={{ width: `${width}%` }} />
      </div>
      <span className="bar-n">{value}</span>
    </div>
  );
}

export default function ActivityPage() {
  const [range, setRange] = useState<"week" | "month">("week");
  const [stats, setStats] = useState<ParentStats | null>(null);
  const [badges, setBadges] = useState<KidAccolades[]>([]);
  const [kids, setKids] = useState<ParentKid[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setStats(null);
    void Promise.all([api.stats(range), api.accolades(), api.kids()])
      .then(([nextStats, farm, kidData]) => {
        setStats(nextStats);
        setBadges(farm.kids);
        setKids(kidData.kids);
      })
      .catch((err: Error) => setError(err.message));
  }, [range]);

  return (
    <div>
      <h2>Kids</h2>
      <p className="muted">
        Who claimed chores, who you approved, and a simple streak (days in a row with at least one approved chore).
        Chicago time. Star wallets and reward history are read-only here — kids browse the full story on their garden
        Profile. Seasonal medals and lifetime legends use the same ledger as the garden 🏅 button.
      </p>
      <div className="row range-toggle">
        <button className={`btn ${range === "week" ? "sage" : ""}`} type="button" onClick={() => setRange("week")}>
          This week
        </button>
        <button className={`btn ${range === "month" ? "sage" : ""}`} type="button" onClick={() => setRange("month")}>
          This month
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {!stats && !error && <p>Counting chores…</p>}
      {stats &&
        stats.kids.map((kid) => (
          <KidCard
            key={kid.id}
            kid={kid}
            badges={badges.find((row) => row.id === kid.id)}
            overview={kids.find((row) => row.id === kid.id)}
          />
        ))}
    </div>
  );
}
