import { FarmTitle, WoodSign } from "../art";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

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
  const [shaking, setShaking] = useState(false);
  const digitsRef = useRef("");
  const busyRef = useRef(false);

  useEffect(() => {
    if (shaking) {
      const t = window.setTimeout(() => setShaking(false), 650);
      return () => window.clearTimeout(t);
    }
  }, [shaking]);

  function push(d: string) {
    if (busyRef.current) return;
    const next = (digitsRef.current + d).slice(0, 4);
    digitsRef.current = next;
    flushSync(() => {
      setDigits(next);
      setError("");
    });
    if (next.length === 4) {
      setBusy(true);
      busyRef.current = true;
      onSubmit(next)
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Wrong PIN");
          setDigits("");
          digitsRef.current = "";
          setShaking(true);
        })
        .finally(() => {
          setBusy(false);
          busyRef.current = false;
        });
    }
  }

  return (
    <div className="pin-backdrop" onClick={onCancel} role="presentation">
      <div className="pin-title">
        <FarmTitle />
      </div>
      <div
        className="pin-buffer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`pin-card ${busy ? "busy" : ""} ${shaking ? "pin-shake" : ""}`}
          role="dialog"
          aria-label="Enter PIN"
        >
        <WoodSign className="pin-sign" label={name.toUpperCase()} />
        <p className="sheet-lede">Enter your 4-digit PIN</p>
        <div className="dots">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`dot ${digits.length > i ? "on" : ""}`} />
          ))}
        </div>
        {error ? <div className="sheet-error pin-error">{error}</div> : null}
        <div className="pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              className="pad-num"
              onPointerDown={(e) => {
                e.preventDefault();
                push(d);
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className="pad-act"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={onCancel}
          >
            ✕
          </button>
          <button
            type="button"
            className="pad-num"
            onPointerDown={(e) => {
              e.preventDefault();
              push("0");
            }}
          >
            0
          </button>
          <button
            type="button"
            className="pad-act"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => {
              const next = digitsRef.current.slice(0, -1);
              digitsRef.current = next;
              setDigits(next);
            }}
          >
            ⌫
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
