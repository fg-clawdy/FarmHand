import {
  SHARED_GOAL_COPY,
  SHARED_GOAL_STARTERS,
  jarTint,
  type ParentSharedGoal,
} from "@farmhand/shared";
import { useEffect, useState } from "react";
import { api, type ParentSharedGoals } from "../api";

function dollars(goal: ParentSharedGoal) {
  return `$${goal.usdFilled} of $${goal.usdTarget}`;
}

function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

function artLabel(goal: ParentSharedGoal) {
  if (goal.artStatus === "QUEUED") return SHARED_GOAL_COPY.artPainting;
  if (goal.artStatus === "READY" && goal.artUrl) return SHARED_GOAL_COPY.artReady;
  if (goal.artStatus === "FAILED") return SHARED_GOAL_COPY.artKeptDefault;
  return SHARED_GOAL_COPY.artDefault;
}

function statusLabel(goal: ParentSharedGoal) {
  if (goal.status === "READY") return "Ready";
  if (goal.status === "WAITING") return "Later";
  if (goal.status === "OPEN") return "Open";
  return goal.status;
}

export default function SharedGoalsPage() {
  const [data, setData] = useState<ParentSharedGoals | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎬");
  const [target, setTarget] = useState("200");
  const [notes, setNotes] = useState("");
  const [generateArt, setGenerateArt] = useState(true);
  const [later, setLater] = useState(false);

  async function refresh() {
    setData(await api.sharedGoals());
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  const painting = Boolean(
    data && [...(data.activeGoals ?? []), ...data.waiting].some((goal) => goal.artStatus === "QUEUED"),
  );

  useEffect(() => {
    if (!painting) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [painting]);

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
        <p className="muted">Opening…</p>
      </section>
    );
  }

  const activeGoals = data.activeGoals ?? (data.active ? [data.active] : []);
  const waiting = data.waiting;
  const queueFull = waiting.length >= 3;
  const artGoals = [...activeGoals, ...waiting];

  return (
    <section id="family-jar">
      <h3>Family jar</h3>
      <p className="muted">{SHARED_GOAL_COPY.parentSharedOnly}</p>
      <p className="muted">{SHARED_GOAL_COPY.parentTrayHint}</p>
      {error && <p className="error">{error}</p>}

      <h3>On the farm</h3>
      {activeGoals.length === 0 && <p className="muted">No jars on the farm.</p>}
      <div className="claim-list">
        {activeGoals.map((goal) => (
          <ActiveJarCard
            key={goal.id}
            goal={goal}
            busy={busy}
            onHappen={() => void run(() => api.happenSharedGoal(goal.id))}
            onPutAway={() => void run(() => api.cancelSharedGoal(goal.id))}
            onTarget={(next) => void run(() => api.patchSharedGoal(goal.id, { targetStars: next }))}
          />
        ))}
      </div>

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
              <button className="btn sage" type="button" disabled={busy} onClick={() => void run(() => api.openSharedGoal(goal.id))}>
                Open
              </button>
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
      <div className="row">
        {SHARED_GOAL_STARTERS.map((starter) => (
          <button
            key={starter.title}
            className="btn"
            type="button"
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
        Title
        <input
          value={title}
          placeholder="e.g., Read 30 minutes together"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="field">
        Emoji
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} />
      </label>
      <label className="field">
        Target stars
        <span className="star-step">
          <button
            className="btn"
            type="button"
            onClick={() => setTarget(String(Math.max(1, (Number(target) || 0) - 10)))}
          >
            −
          </button>
          <input value={target} inputMode="numeric" onChange={(e) => setTarget(e.target.value)} />
          <button className="btn" type="button" onClick={() => setTarget(String((Number(target) || 0) + 10))}>
            +
          </button>
        </span>
      </label>
      <label className="field">
        AI design notes (optional)
        <textarea
          value={notes}
          rows={3}
          maxLength={500}
          placeholder="e.g., cozy reading nook, books, warm lamp, soft greens."
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label className="choice">
        <input type="checkbox" checked={generateArt} onChange={(e) => setGenerateArt(e.target.checked)} />
        Generate cork badge art with AI (background)
      </label>
      <p className="muted">Default art shows instantly.</p>
      <label className="choice">
        <input
          type="checkbox"
          checked={later}
          disabled={queueFull}
          onChange={(e) => setLater(e.target.checked)}
        />
        Save for later
      </label>
      {later && queueFull && <p>{SHARED_GOAL_COPY.parentQueueFull}</p>}
      <p className="muted">{SHARED_GOAL_COPY.parentCreateHint}</p>
      <button
        className="btn sage"
        type="button"
        disabled={busy || !title.trim() || !emoji.trim() || (later && queueFull)}
        onClick={() =>
          void run(async () => {
            await api.createSharedGoal({
              title: title.trim(),
              emoji: emoji.trim(),
              targetStars: Number(target),
              artNotes: notes.trim() || undefined,
              generateArt,
              queue: later,
            });
            setTitle("");
            setNotes("");
          })
        }
      >
        Add
      </button>

      <h3>Shared goal art</h3>
      {artGoals.length === 0 && <p className="muted">Add a goal and it gets a pastel badge right away.</p>}
      <div className="claim-list">
        {artGoals.map((goal) => (
          <GoalArtCard
            key={goal.id}
            goal={goal}
            busy={busy}
            onRegenerate={() => void run(() => api.regenerateSharedGoalArt(goal.id))}
            onSave={(body) => void run(() => api.updateSharedGoalArt(goal.id, body))}
          />
        ))}
      </div>

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

function JarPreview({ goal }: { goal: ParentSharedGoal }) {
  const tint = jarTint(goal.tintIndex ?? 0);
  const ratio = goal.targetStars > 0 ? Math.max(0, Math.min(1, goal.filledStars / goal.targetStars)) : 0;
  return (
    <div className="jar-preview" aria-hidden="true">
      <div className="cork">{goal.artUrl ? <img src={goal.artUrl} alt="" /> : goal.emoji}</div>
      <div className="bore" style={{ background: tint.glass, borderColor: tint.rim }}>
        <div className="fill" style={{ height: `${Math.round(ratio * 100)}%`, background: tint.fill }} />
      </div>
    </div>
  );
}

function ActiveJarCard({
  goal,
  busy,
  onHappen,
  onPutAway,
  onTarget,
}: {
  goal: ParentSharedGoal;
  busy: boolean;
  onHappen: () => void;
  onPutAway: () => void;
  onTarget: (targetStars: number) => void;
}) {
  const [confirmPutAway, setConfirmPutAway] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const next = Number(targetDraft);
  const raising = Number.isInteger(next) && next > goal.targetStars;
  return (
    <article className="card">
      <div className="jar-art-row">
        <JarPreview goal={goal} />
        <div className="jar-art-copy">
          <h3 style={{ marginTop: 0 }}>
            {goal.emoji} {goal.title} <em className="badge">{statusLabel(goal)}</em>
          </h3>
          <p>
            {dollars(goal)} · {goal.filledStars}★ / {goal.targetStars}★
          </p>
        </div>
      </div>
      <ul>
        {goal.contributions.map((row) => (
          <li key={row.playerId}>
            {row.playerName}: {row.netGiven}★
          </li>
        ))}
      </ul>
      {goal.status === "READY" && (
        <button className="btn sage" type="button" disabled={busy} onClick={onHappen}>
          It happened
        </button>
      )}
      {!confirmPutAway ? (
        <button className="btn stamp" type="button" disabled={busy} onClick={() => setConfirmPutAway(true)}>
          Put away
        </button>
      ) : (
        <div>
          <p>{fill(SHARED_GOAL_COPY.parentSwitch, { title: goal.title })}</p>
          <button className="btn stamp" type="button" disabled={busy} onClick={onPutAway}>
            Put away
          </button>
          <button className="btn" type="button" disabled={busy} onClick={() => setConfirmPutAway(false)}>
            Not now
          </button>
        </div>
      )}
      <label className="field">
        Target stars
        <input value={targetDraft} placeholder={String(goal.targetStars)} inputMode="numeric" onChange={(e) => setTargetDraft(e.target.value)} />
        {raising && <span>This makes the jar take longer.</span>}
        <button className="btn" type="button" disabled={busy || !Number.isInteger(next) || next < 1} onClick={() => onTarget(next)}>
          Save target
        </button>
      </label>
    </article>
  );
}

function GoalArtCard({
  goal,
  busy,
  onRegenerate,
  onSave,
}: {
  goal: ParentSharedGoal;
  busy: boolean;
  onRegenerate: () => void;
  onSave: (body: { artPrompt: string; regenerate?: boolean }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(goal.artPrompt ?? "");

  useEffect(() => {
    if (!editing) setPrompt(goal.artPrompt ?? "");
  }, [goal.artPrompt, editing]);

  return (
    <article className="card">
      <div className="jar-art-row">
        <JarPreview goal={goal} />
        <div className="jar-art-copy">
          <h3>
            {goal.title} <em className="badge">{statusLabel(goal)}</em>
          </h3>
          <p className="muted">
            {goal.targetStars}★ · {artLabel(goal)}
          </p>
          <div className="row">
            <button className="btn" type="button" disabled={busy || goal.artStatus === "QUEUED"} onClick={onRegenerate}>
              Regenerate
            </button>
            <button className="btn" type="button" disabled={busy} onClick={() => setEditing((open) => !open)}>
              Edit prompt
            </button>
          </div>
        </div>
      </div>
      {editing && (
        <label className="field">
          Badge prompt
          <textarea value={prompt} rows={4} maxLength={1500} onChange={(e) => setPrompt(e.target.value)} />
          <div className="row">
            <button
              className="btn"
              type="button"
              disabled={busy || !prompt.trim()}
              onClick={() => onSave({ artPrompt: prompt.trim() })}
            >
              Save prompt
            </button>
            <button
              className="btn sage"
              type="button"
              disabled={busy || !prompt.trim()}
              onClick={() => onSave({ artPrompt: prompt.trim(), regenerate: true })}
            >
              Save and paint
            </button>
          </div>
        </label>
      )}
    </article>
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
