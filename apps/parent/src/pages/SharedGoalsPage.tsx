import { SHARED_GOAL_COPY, SHARED_GOAL_STARTERS, type ParentSharedGoal } from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type ParentSharedGoals } from "../api";

function dollars(goal: ParentSharedGoal) {
  return `$${goal.usdFilled} of $${goal.usdTarget}`;
}

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export default function SharedGoalsPage() {
  const [data, setData] = useState<ParentSharedGoals | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPutAway, setConfirmPutAway] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎬");
  const [target, setTarget] = useState("200");
  const [targetDraft, setTargetDraft] = useState("");

  async function refresh() {
    setData(await api.sharedGoals());
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <section id="family-jar">
        <h3>Family jar</h3>
        <p className="muted">Opening the jar…</p>
      </section>
    );
  }

  const active = data.active;
  const waiting = data.waiting;
  const queueFull = waiting.length >= 3;

  return (
    <section id="family-jar">
      <h3>Family jar</h3>
      <p className="muted">{SHARED_GOAL_COPY.parentSharedOnly}</p>
      {error && <p className="error">{error}</p>}

      <h3>Now</h3>
      {!active && <p className="muted">No jar on the farm.</p>}
      {active && (
        <article className="card">
          <h3 style={{ marginTop: 0 }}>
            {active.emoji} {active.title}
          </h3>
          <p>
            {dollars(active)} · {active.status === "READY" ? "Ready" : "Open"} · {active.filledStars}★ / {active.targetStars}★
          </p>
          <ul>
            {active.contributions.map((row) => (
              <li key={row.playerId}>
                {row.playerName}: {row.netGiven}★
              </li>
            ))}
          </ul>
          {active.status === "READY" && (
            <button className="btn sage" type="button" disabled={busy} onClick={() => void run(() => api.happenSharedGoal(active.id))}>
              It happened
            </button>
          )}
          {!confirmPutAway ? (
            <button className="btn stamp" type="button" disabled={busy} onClick={() => setConfirmPutAway(true)}>
              Put away
            </button>
          ) : (
            <div>
              <p>{fill(SHARED_GOAL_COPY.parentSwitch, { title: active.title })}</p>
              <button className="btn stamp" type="button" disabled={busy} onClick={() => void run(async () => {
                await api.cancelSharedGoal(active.id);
                setConfirmPutAway(false);
              })}>
                Put away
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => setConfirmPutAway(false)}>
                Not now
              </button>
            </div>
          )}
          <TargetEdit
            goal={active}
            draft={targetDraft}
            setDraft={setTargetDraft}
            busy={busy}
            onSave={(next) => void run(() => api.patchSharedGoal(active.id, { targetStars: next }))}
          />
        </article>
      )}
      <h3>{SHARED_GOAL_COPY.parentQueueLabel}</h3>
      {waiting.length === 0 && <p className="muted">Nothing waiting.</p>}
      <div className="claim-list">
        {waiting.map((goal, index) => (
          <article key={goal.id} className="card">
            <h3 style={{ marginTop: 0 }}>
              {goal.emoji} {goal.title}
            </h3>
            <p className="muted">${goal.usdTarget} · {goal.targetStars}★</p>
            <div className="row">
              {!active && (
                <button className="btn sage" type="button" disabled={busy} onClick={() => void run(() => api.openSharedGoal(goal.id))}>
                  Open
                </button>
              )}
              <button className="btn" type="button" disabled={busy || index === 0} onClick={() => void move(waiting, index, -1, run)}>
                Up
              </button>
              <button className="btn" type="button" disabled={busy || index === waiting.length - 1} onClick={() => void move(waiting, index, 1, run)}>
                Down
              </button>
              <button className="btn stamp" type="button" disabled={busy} onClick={() => void run(() => api.removeSharedGoal(goal.id))}>
                Remove
              </button>
            </div>
            <WaitingEdit goal={goal} busy={busy} onSave={(body) => void run(() => api.patchSharedGoal(goal.id, body))} />
          </article>
        ))}
      </div>

      <h3>Add a jar</h3>
      {queueFull && <p>{SHARED_GOAL_COPY.parentQueueFull}</p>}
      <div className="row">
        {SHARED_GOAL_STARTERS.map((starter) => (
          <button
            key={starter.title}
            className="btn"
            type="button"
            disabled={queueFull}
            onClick={() => {
              setTitle(starter.title);
              setEmoji(starter.emoji);
              setTarget(String(starter.targetStars));
            }}
          >
            {starter.emoji} {starter.title}
          </button>
        ))}
      </div>
      <label className="field">
        Name
        <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={queueFull} />
      </label>
      <label className="field">
        Emoji
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} disabled={queueFull} maxLength={8} />
      </label>
      <label className="field">
        Stars
        <input value={target} inputMode="numeric" onChange={(e) => setTarget(e.target.value)} disabled={queueFull} />
      </label>
      <p className="muted">{SHARED_GOAL_COPY.parentCreateHint}</p>
      <button
        className="btn sage"
        type="button"
        disabled={busy || queueFull || !title.trim() || !emoji.trim()}
        onClick={() =>
          void run(async () => {
            await api.createSharedGoal({ title: title.trim(), emoji: emoji.trim(), targetStars: Number(target) });
            setTitle("");
          })
        }
      >
        Add
      </button>

      <h3>Who can add</h3>
      <div className="claim-list">
        {data.players.map((player) => (
          <article key={player.playerId} className="card">
            <h3 style={{ marginTop: 0 }}>{player.playerName}</h3>
            <label className="choice">
              <input
                type="checkbox"
                checked={player.givingEnabled}
                disabled={busy}
                onChange={(e) => void run(() => api.patchGiving(player.playerId, { givingEnabled: e.target.checked }))}
              />
              Can add stars
            </label>
            <label className="field">
              Most at a time
              <input
                key={`${player.playerId}-${player.giveCeiling}`}
                defaultValue={String(player.giveCeiling)}
                inputMode="numeric"
                disabled={busy}
                onBlur={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isInteger(next) && next >= 1 && next !== player.giveCeiling) {
                    void run(() => api.patchGiving(player.playerId, { giveCeiling: next }));
                  }
                }}
              />
            </label>
          </article>
        ))}
      </div>

      {data.history.length > 0 && (
        <>
          <h3>History</h3>
          <div className="claim-list">
            {data.history.map((goal) => (
              <article key={goal.id} className="card">
                <h3 style={{ marginTop: 0 }}>
                  {goal.emoji} {goal.title}
                </h3>
                <p className="muted">
                  {goal.status === "HAPPENED"
                    ? fill(SHARED_GOAL_COPY.happened, { title: goal.title })
                    : fill(SHARED_GOAL_COPY.putAway, { title: goal.title })}
                  {" "}· {dollars(goal)}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function TargetEdit({
  goal,
  draft,
  setDraft,
  busy,
  onSave,
}: {
  goal: ParentSharedGoal;
  draft: string;
  setDraft: (value: string) => void;
  busy: boolean;
  onSave: (targetStars: number) => void;
}) {
  const next = Number(draft);
  const raising = Number.isInteger(next) && next > goal.targetStars;
  return (
    <label className="field">
      Target stars
      <input value={draft} placeholder={String(goal.targetStars)} inputMode="numeric" onChange={(e) => setDraft(e.target.value)} />
      {raising && <span>This makes the jar take longer.</span>}
      <button className="btn" type="button" disabled={busy || !Number.isInteger(next) || next < 1} onClick={() => onSave(next)}>
        Save target
      </button>
    </label>
  );
}

function WaitingEdit({
  goal,
  busy,
  onSave,
}: {
  goal: ParentSharedGoal;
  busy: boolean;
  onSave: (body: { title: string; emoji: string; targetStars: number }) => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [emoji, setEmoji] = useState(goal.emoji);
  const [stars, setStars] = useState(String(goal.targetStars));
  return (
    <div className="row">
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Name" />
      <input value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji" maxLength={8} />
      <input value={stars} inputMode="numeric" onChange={(e) => setStars(e.target.value)} aria-label="Stars" />
      <button
        className="btn"
        type="button"
        disabled={busy}
        onClick={() => onSave({ title: title.trim(), emoji: emoji.trim(), targetStars: Number(stars) })}
      >
        Save
      </button>
    </div>
  );
}

async function move(
  waiting: ParentSharedGoal[],
  index: number,
  dir: -1 | 1,
  run: (work: () => Promise<unknown>) => Promise<void>,
) {
  const other = waiting[index + dir];
  const current = waiting[index];
  if (!other || !current) return;
  await run(async () => {
    await api.patchSharedGoal(current.id, { sortOrder: other.sortOrder });
    await api.patchSharedGoal(other.id, { sortOrder: current.sortOrder });
  });
}

