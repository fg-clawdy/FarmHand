import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type ParentChore, type ParentKid, type ChoreWrite } from "../api";

const RECURRENCE = [
  { value: "DAILY", label: "Every day" },
  { value: "WEEKDAYS", label: "Weekdays" },
  { value: "WEEKLY", label: "Once a week" },
  { value: "NONE", label: "Whenever / one-off" },
];
const TIMES = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
  { value: "ANYTIME", label: "Anytime" },
];
const PRIORITIES = [
  { value: "CRITICAL", label: "Must do (dog chores)" },
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];

type FormState = {
  title: string;
  emoji: string;
  description: string;
  recurrence: string;
  timeOfDay: string;
  priority: string;
  estimatedMinutes: string;
  requiresApproval: boolean;
  requiresSelfie: boolean;
  allowsSkip: boolean;
  includeInPath: boolean;
  isActive: boolean;
  assignmentMode: string;
  assignedPlayerIds: string[];
};

const blank: FormState = {
  title: "",
  emoji: "⭐",
  description: "",
  recurrence: "DAILY",
  timeOfDay: "ANYTIME",
  priority: "NORMAL",
  estimatedMinutes: "",
  requiresApproval: true,
  requiresSelfie: false,
  allowsSkip: false,
  includeInPath: true,
  isActive: true,
  assignmentMode: "ALL",
  assignedPlayerIds: [],
};

function fromChore(chore: ParentChore): FormState {
  return {
    title: chore.title,
    emoji: chore.emoji,
    description: chore.description,
    recurrence: chore.recurrence,
    timeOfDay: chore.timeOfDay,
    priority: chore.priority,
    estimatedMinutes: chore.estimatedMinutes == null ? "" : String(chore.estimatedMinutes),
    requiresApproval: chore.requiresApproval,
    requiresSelfie: chore.requiresSelfie,
    allowsSkip: chore.allowsSkip,
    includeInPath: chore.includeInPath,
    isActive: chore.isActive,
    assignmentMode: chore.assignmentMode,
    assignedPlayerIds: chore.assignedPlayerIds,
  };
}

function toWrite(form: FormState): ChoreWrite {
  const minutes = form.estimatedMinutes.trim();
  return {
    title: form.title,
    emoji: form.emoji,
    description: form.description,
    recurrence: form.recurrence,
    timeOfDay: form.timeOfDay,
    priority: form.priority,
    estimatedMinutes: minutes === "" ? null : Number(minutes),
    requiresApproval: form.requiresApproval,
    requiresSelfie: form.requiresSelfie,
    allowsSkip: form.allowsSkip,
    includeInPath: form.includeInPath,
    isActive: form.isActive,
    assignmentMode: form.assignmentMode,
    assignedPlayerIds: form.assignmentMode === "SPECIFIC" ? form.assignedPlayerIds : [],
  };
}

export default function ChoreEditPage() {
  const { id } = useParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(blank);
  const [kids, setKids] = useState<ParentKid[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(isNew);
  const [originalPriority, setOriginalPriority] = useState<string | null>(null);

  useEffect(() => {
    void api.kids().then((data) => setKids(data.kids)).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (isNew) return;
    void api
      .chore(id)
      .then((data) => {
        setForm(fromChore(data.chore));
        setOriginalPriority(data.chore.priority);
        setReady(true);
      })
      .catch((err: Error) => setError(err.message));
  }, [id, isNew]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = toWrite(form);
      if (isNew) await api.createChore(body);
      else if (id) await api.updateChore(id, body);
      navigate("/chores");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready && !error) return <p>Opening that chore…</p>;

  const showCriticalNote = !isNew && originalPriority === "CRITICAL" && form.priority !== "CRITICAL";

  return (
    <div>
      <p>
        <Link to="/chores">← All chores</Link>
      </p>
      <h2>{isNew ? "Add a chore" : "Edit chore"}</h2>
      <p className="muted">Kids still get 1 waiting seed when they claim. There is no extra seed for longer jobs.</p>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field">
          Title
          <input value={form.title} onChange={(e) => patch("title", e.target.value)} required />
        </label>
        <label className="field">
          Emoji
          <input value={form.emoji} onChange={(e) => patch("emoji", e.target.value)} maxLength={8} />
        </label>
        <label className="field">
          Note for parents (optional)
          <textarea value={form.description} onChange={(e) => patch("description", e.target.value)} rows={3} />
        </label>
        <label className="field">
          How often
          <select value={form.recurrence} onChange={(e) => patch("recurrence", e.target.value)}>
            {RECURRENCE.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Time of day
          <select value={form.timeOfDay} onChange={(e) => patch("timeOfDay", e.target.value)}>
            {TIMES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Priority
          <select value={form.priority} onChange={(e) => patch("priority", e.target.value)}>
            {PRIORITIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {showCriticalNote && (
          <p className="error">This was a must-do dog chore. Change priority only if you mean to.</p>
        )}
        <label className="field">
          About how long (minutes)
          <input
            inputMode="numeric"
            value={form.estimatedMinutes}
            onChange={(e) => patch("estimatedMinutes", e.target.value)}
            placeholder="optional note"
          />
          <span className="muted">Display only for now. Does not change the 1-seed grant.</span>
        </label>

        <fieldset className="field">
          <legend>Who can claim it</legend>
          <label className="choice">
            <input
              type="radio"
              name="assignment"
              checked={form.assignmentMode === "ALL"}
              onChange={() => patch("assignmentMode", "ALL")}
            />
            Every kid
          </label>
          <label className="choice">
            <input
              type="radio"
              name="assignment"
              checked={form.assignmentMode === "RACE"}
              onChange={() => patch("assignmentMode", "RACE")}
            />
            First one to claim (race)
          </label>
          <label className="choice">
            <input
              type="radio"
              name="assignment"
              checked={form.assignmentMode === "SPECIFIC"}
              onChange={() => patch("assignmentMode", "SPECIFIC")}
            />
            Only these kids
          </label>
          {form.assignmentMode === "SPECIFIC" && (
            <div className="kid-picks">
              {kids.map((kid) => (
                <label key={kid.id} className="choice">
                  <input
                    type="checkbox"
                    checked={form.assignedPlayerIds.includes(kid.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.assignedPlayerIds, kid.id]
                        : form.assignedPlayerIds.filter((id) => id !== kid.id);
                      patch("assignedPlayerIds", next);
                    }}
                  />
                  {kid.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="choice">
          <input
            type="checkbox"
            checked={form.requiresApproval}
            onChange={(e) => patch("requiresApproval", e.target.checked)}
          />
          Needs your OK before the plant grows
        </label>
        <label className="choice">
          <input
            type="checkbox"
            checked={form.requiresSelfie}
            onChange={(e) => patch("requiresSelfie", e.target.checked)}
          />
          Kid must take a photo
        </label>
        <label className="choice">
          <input type="checkbox" checked={form.allowsSkip} onChange={(e) => patch("allowsSkip", e.target.checked)} />
          Kids can skip
        </label>
        <label className="choice">
          <input
            type="checkbox"
            checked={form.includeInPath}
            onChange={(e) => patch("includeInPath", e.target.checked)}
          />
          Show on the Job Board
        </label>
        <label className="choice">
          <input type="checkbox" checked={form.isActive} onChange={(e) => patch("isActive", e.target.checked)} />
          This chore is on
        </label>

        {error && <p className="error">{error}</p>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn sage" type="submit" disabled={busy}>
            {isNew ? "Add chore" : "Save"}
          </button>
          <Link className="btn" to="/chores">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
