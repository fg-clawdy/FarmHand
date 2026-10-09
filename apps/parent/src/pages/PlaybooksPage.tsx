import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ParentChore, type ParentPlaybook, type PlaybookWrite } from "../api";

function minutesToHHMM(minutes: number | null): string {
  if (minutes == null) return "";
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function hhmmToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [h, m] = trimmed.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

type PlaybookForm = {
  title: string;
  emoji: string;
  description: string;
  windowStart: string;
  windowEnd: string;
  isActive: boolean;
  choreIds: string[];
};

const blank: PlaybookForm = {
  title: "",
  emoji: "📋",
  description: "",
  windowStart: "",
  windowEnd: "",
  isActive: true,
  choreIds: [],
};

function fromPlaybook(pb: ParentPlaybook): PlaybookForm {
  return {
    title: pb.title,
    emoji: pb.emoji,
    description: pb.description,
    windowStart: pb.windowStart === 0 ? "" : minutesToHHMM(pb.windowStart),
    windowEnd: minutesToHHMM(pb.windowEnd === 1440 ? null : pb.windowEnd),
    isActive: pb.isActive,
    choreIds: pb.choreIds,
  };
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<ParentPlaybook[] | null>(null);
  const [chores, setChores] = useState<ParentChore[]>([]);
  const [editing, setEditing] = useState<ParentPlaybook | "new" | null>(null);
  const [form, setForm] = useState<PlaybookForm>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [pbData, choreData] = await Promise.all([api.playbooks(), api.chores()]);
    setPlaybooks(pbData.playbooks);
    setChores(choreData.chores);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
  }, []);

  function patch<K extends keyof PlaybookForm>(key: K, value: PlaybookForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChore(id: string) {
    patch(
      "choreIds",
      form.choreIds.includes(id) ? form.choreIds.filter((x) => x !== id) : [...form.choreIds, id],
    );
  }

  async function save() {
    setBusy(true);
    setError("");
    const windowEnd = hhmmToMinutes(form.windowEnd);
    const body: PlaybookWrite = {
      title: form.title,
      emoji: form.emoji,
      description: form.description,
      windowStart: hhmmToMinutes(form.windowStart),
      windowEnd: windowEnd === 0 ? 1440 : windowEnd,
      isActive: form.isActive,
      choreIds: form.choreIds,
    };
    try {
      if (editing === "new") await api.createPlaybook(body);
      else if (editing) await api.updatePlaybook(editing.id, body);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(playbook: ParentPlaybook) {
    setError("");
    try {
      await api.updatePlaybook(playbook.id, { isActive: !playbook.isActive });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  async function remove(playbook: ParentPlaybook) {
    if (!window.confirm(`Delete “${playbook.title}”? Chores are not deleted.`)) return;
    setError("");
    try {
      await api.deletePlaybook(playbook.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  if (!playbooks) {
    return (
      <div>
        <h2>Playbooks</h2>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Playbooks</h2>
      <p className="muted">
        Bundled chores that broadcast on the kid's Job Board as a mission checklist. Finishing the{" "}
        <strong>Morning</strong> playbook counts toward the Morning Person badge.
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <button
          className="btn sage"
          type="button"
          onClick={() => {
            setForm(blank);
            setEditing("new");
          }}
        >
          New playbook
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {editing && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3>{editing === "new" ? "New playbook" : `Edit ${editing.title}`}</h3>
          <label className="field">
            Title
            <input value={form.title} onChange={(e) => patch("title", e.target.value)} required />
          </label>
          <label className="field">
            Emoji
            <input value={form.emoji} onChange={(e) => patch("emoji", e.target.value)} maxLength={8} />
          </label>
          <label className="field">
            Note (optional)
            <textarea value={form.description} onChange={(e) => patch("description", e.target.value)} rows={2} />
          </label>
          <fieldset className="field">
            <legend>Broadcast window (optional)</legend>
            <label className="field">
              On air from
              <input
                type="time"
                value={form.windowStart}
                onChange={(e) => patch("windowStart", e.target.value)}
              />
            </label>
            <label className="field">
              Off air by
              <input
                type="time"
                value={form.windowEnd}
                onChange={(e) => patch("windowEnd", e.target.value)}
              />
            </label>
            <span className="muted">Blank = always broadcast.</span>
          </fieldset>
          <label className="choice">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => patch("isActive", e.target.checked)}
            />
            This playbook is on
          </label>
          <fieldset className="field">
            <legend>Chores in this playbook</legend>
            <div className="kid-picks">
              {chores.map((chore) => (
                <label key={chore.id} className="choice">
                  <input
                    type="checkbox"
                    checked={form.choreIds.includes(chore.id)}
                    onChange={() => toggleChore(chore.id)}
                  />
                  {chore.emoji} {chore.title}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn sage" type="submit" disabled={busy}>
              Save
            </button>
            <button className="btn" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="claim-list">
        {playbooks.map((playbook) => (
          <article key={playbook.id} className={`card chore-card ${playbook.isActive ? "" : "off"}`}>
            <div className="claim-head">
              <span className="emoji">{playbook.emoji}</span>
              <div>
                <h3>
                  {playbook.title}
                  {!playbook.isActive && (
                    <em className="badge off" style={{ background: "#7a6a55" }}>
                      Off
                    </em>
                  )}
                </h3>
                <p>
                  {playbook.choreIds.length
                    ? `${playbook.choreIds.length} chore${playbook.choreIds.length === 1 ? "" : "s"}`
                    : "No chores yet"}
                  {playbook.windowLabel ? ` · ${playbook.windowLabel}` : " · always on air"}
                </p>
                <span>
                  {playbook.chores.map((item) => (
                    <span key={item.choreId} style={{ marginRight: 8 }}>
                      {item.emoji}
                    </span>
                  ))}
                </span>
              </div>
            </div>
            <div className="row">
              <button className="btn" type="button" onClick={() => void toggle(playbook)}>
                {playbook.isActive ? "Turn off" : "Turn on"}
              </button>
              <button
                className="btn sage"
                type="button"
                onClick={() => {
                  setForm(fromPlaybook(playbook));
                  setEditing(playbook);
                }}
              >
                Edit
              </button>
              <button className="btn danger" type="button" onClick={() => void remove(playbook)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 16 }}>
        <Link to="/chores">← Back to chores</Link>
      </p>
    </div>
  );
}
