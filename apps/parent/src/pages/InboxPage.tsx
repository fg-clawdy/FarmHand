import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CURRENCY_DISPLAY, formatCountdown, formatPoints } from "@farmhand/shared";
import { api, type InboxClaim, type InboxPlot, type ParentRedemption } from "../api";
import PushSettings from "../components/PushSettings";
import { pendingApprovalSubjects, syncApprovalNotifications } from "../push";

/** Muted, light per-child background colors (hex). One per child, in section order. */
const CHILD_COLORS = [
  "#f2d7d5", // soft red
  "#fdebd0", // soft apricot
  "#fcf3cf", // soft yellow
  "#d5f5e3", // soft green
  "#d6eaf8", // soft blue
  "#e8daef", // soft lavender
  "#f5eef8", // soft periwinkle
  "#fbeae1", // soft peach
];

const CHILD_COLOR_ALPHA = 0.3; // 30% opacity / 70% transparency, as requested.

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Stable pastel pick per child, so a child keeps "their" color across views and refreshes. */
function colorIndexFor(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return hash % CHILD_COLORS.length;
}

/** Server-computed maturity, rendered as a terse, tasteful line. */
function maturityLabel(plot: InboxPlot): string {
  if (plot.state === "wilted") return "Wilted";
  if (plot.ready) return "Ready to harvest";
  if (plot.maturesAt) return `Matures in ${formatCountdown(plot.remainingMs)}`;
  return "Starts growing on approval";
}

type KidGroup = { player: InboxClaim["player"]; color: string; claims: InboxClaim[] };

const MASCOT_EMOJI: Record<string, string> = {
  cow: "🐮",
  chicken: "🐔",
  pig: "🐷",
  sheep: "🐑",
  horse: "🐴",
};

export default function InboxPage() {
  const [claims, setClaims] = useState<InboxClaim[] | null>(null);
  const [redemptions, setRedemptions] = useState<ParentRedemption[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function applyInbox(data: { claims: InboxClaim[]; redemptions?: ParentRedemption[] }) {
    setClaims(data.claims);
    setRedemptions(data.redemptions ?? []);
    void syncApprovalNotifications(pendingApprovalSubjects(data));
  }

  async function refresh() {
    applyInbox(await api.inbox());
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    const t = setInterval(() => void refresh().catch(() => undefined), 8000);
    return () => clearInterval(t);
  }, []);

  async function act(id: string, action: "approve" | "deny") {
    setBusyId(id);
    setError("");
    try {
      const data = action === "approve" ? await api.approve(id) : await api.deny(id);
      applyInbox(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function storeAct(id: string, action: "approve" | "deny") {
    setBusyId(id);
    setError("");
    try {
      const data = action === "approve" ? await api.approveRedemption(id) : await api.denyRedemption(id);
      applyInbox(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  if (!claims) {
    return (
      <div>
        <p>Loading the inbox…</p>
        <PushSettings />
      </div>
    );
  }

  const empty = claims.length === 0 && redemptions.length === 0;

  // Group claims by child, keeping the CRITICAL-first / oldest-first order the API sends.
  const groups: KidGroup[] = [];
  const orderByPlayer = new Map<string, number>();
  const usedColors = new Set<number>();
  for (const claim of claims) {
    const pid = claim.player.id;
    let order = orderByPlayer.get(pid);
    if (order === undefined) {
      order = orderByPlayer.size;
      orderByPlayer.set(pid, order);
      let colorIndex = colorIndexFor(pid);
      while (usedColors.has(colorIndex)) colorIndex = (colorIndex + 1) % CHILD_COLORS.length;
      usedColors.add(colorIndex);
      groups[order] = {
        player: claim.player,
        color: CHILD_COLORS[colorIndex],
        claims: [],
      };
    }
    groups[order].claims.push(claim);
  }

  return (
    <div>
      <h2>Inbox</h2>
      <p className="muted">
        Dog chores are listed first. Approve starts the plant growing. Deny wilts it — the kid prunes, no seed back.
        Store requests hold {CURRENCY_DISPLAY.noun} until you Approve (kid owns it) or Deny ({CURRENCY_DISPLAY.noun} come back). Notifications are optional; this
        inbox is the fallback if push is off or a tap is stale.
      </p>
      <PushSettings />
      {error && <p className="error">{error}</p>}
      {empty && <p className="card">Nothing waiting. Kids can keep claiming chores and asking for store rewards.</p>}

      {redemptions.length > 0 && (
        <>
          <h3>
            Store requests{" "}
            <Link to="/store" style={{ fontSize: 16, fontWeight: 400 }}>
              Catalog
            </Link>
          </h3>
          <div className="claim-list">
            {redemptions.map((row) => (
              <article key={row.id} className="card claim">
                <div className="claim-head">
                  <span className="emoji">{row.emoji}</span>
                  <div>
                    <h3>{row.title}</h3>
                    <p>
                      {row.player.name} · {formatPoints(row.pointCost)} held
                    </p>
                  </div>
                </div>
                <div className="row">
                  <button
                    className="btn sage"
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void storeAct(row.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn stamp"
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void storeAct(row.id, "deny")}
                  >
                    Deny
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <h3>Chore claims</h3>
      {claims.length === 0 && !empty && <p className="card">No chore claims waiting.</p>}
      {groups.map((group) => (
        <section key={group.player.id} className="kid-group">
          <h4 className="kid-group-head" style={{ background: withAlpha(group.color, CHILD_COLOR_ALPHA) }}>
            <span className="emoji">{MASCOT_EMOJI[group.player.mascot] ?? "🌱"}</span>
            {group.player.name}
            <span className="muted">{group.claims.length} claim{group.claims.length === 1 ? "" : "s"}</span>
          </h4>
          <div className="claim-list">
            {group.claims.map((claim) => (
              <article
                key={claim.id}
                className={`card claim ${claim.priority === "CRITICAL" ? "critical" : ""}`}
                style={{ background: withAlpha(group.color, CHILD_COLOR_ALPHA) }}
              >
                <div className="claim-head">
                  <span className="emoji">{claim.chore.emoji}</span>
                  <div>
                    <h3>
                      {claim.chore.title}
                      {claim.priority === "CRITICAL" && <em className="badge">CRITICAL</em>}
                    </h3>
                    <p>
                      {claim.player.name}
                      {claim.claimedWhen ? ` · claimed ${claim.claimedWhen}` : ""}
                      {claim.hasPhoto ? " · photo attached" : ""}
                    </p>
                  </div>
                </div>
                {claim.chore.description && <p>{claim.chore.description}</p>}
                {(claim.plots ?? []).length > 0 && (
                  <ul className="chore-break seed-panels">
                    {(claim.plots ?? []).map((plot) => (
                      <li key={`${claim.id}-${plot.slot}`} className="seed-panel">
                        <div className="seed-line">
                          <span>
                            Plot {plot.slot + 1}
                            {plot.cropTier ? ` · tier ${plot.cropTier} crop` : ""}
                            {plot.seedsUsed > 1 ? ` · ${plot.seedsUsed} seeds used` : ""}
                          </span>
                          <span className="muted">{plot.playerName}</span>
                        </div>
                        <p className={`seed-line plot-maturity${plot.ready ? " ready" : ""}`}>
                          <span>{maturityLabel(plot)}</span>
                        </p>
                        <p className="muted seed-line">
                          {plot.otherProvisionalSeeds.length > 0 ? (
                            <>
                              Also provisional here:{" "}
                              {plot.otherProvisionalSeeds.map((seed) => `${seed.emoji} ${seed.title}`).join(", ")}
                            </>
                          ) : (
                            "No other provisional seeds in this plot."
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {claim.hasPhoto && (
                  <img
                    className="proof"
                    alt={`Photo from ${claim.player.name}`}
                    src={`/api/parent/claims/${claim.id}/photo`}
                  />
                )}
                <div className="row">
                  <button
                    className="btn sage"
                    type="button"
                    disabled={busyId === claim.id}
                    onClick={() => void act(claim.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn stamp"
                    type="button"
                    disabled={busyId === claim.id}
                    onClick={() => void act(claim.id, "deny")}
                  >
                    Deny
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
