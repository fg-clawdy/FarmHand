import { FarmTitle, SceneShell, WoodSign } from "../art";
import { useState } from "react";

export default function PinPad({
  name,
  onSubmit,
  onCancel,
}: {
  name: string;
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function push(d: string) {
    if (busy) return;
    const next = (digits + d).slice(0, 4);
    setDigits(next);
    setError("");
    if (next.length === 4) {
      setBusy(true);
      try {
        await onSubmit(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wrong PIN");
        setDigits("");
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <SceneShell dim className="pin">
      <div className="pin-title">
        <FarmTitle />
      </div>
      <div className={`pin-card ${busy ? "busy" : ""}`}>
        <WoodSign className="pin-sign" label={name.toUpperCase()} />
        <p>Enter your 4-digit PIN</p>
        <div className="dots">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`dot ${digits.length > i ? "on" : ""}`} />
          ))}
        </div>
        <div className="pin-error">{error}</div>
        <div className="pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => void push(d)}>
              {d}
            </button>
          ))}
          <button type="button" onClick={onCancel}>
            ✕
          </button>
          <button type="button" onClick={() => void push("0")}>
            0
          </button>
          <button type="button" onClick={() => setDigits((v) => v.slice(0, -1))}>
            ⌫
          </button>
        </div>
      </div>
    </SceneShell>
  );
}
