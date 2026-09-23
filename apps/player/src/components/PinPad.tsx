import { FarmTitle, WoodSign } from "../art";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

/** Memoized so digit state updates never rebuild title/sign SVG (WoodSign uses useUid). */
const TitleChrome = memo(function TitleChrome() {
  return (
    <div className="pin-title">
      <FarmTitle />
    </div>
  );
});

const SignChrome = memo(function SignChrome({ name }: { name: string }) {
  return <WoodSign className="pin-sign" label={name.toUpperCase()} />;
});

function syncDots(root: HTMLElement | null, len: number) {
  if (!root) return;
  const kids = root.children;
  for (let i = 0; i < kids.length; i++) {
    kids[i].classList.toggle("on", i < len);
  }
}

function pressFlash(el: HTMLElement) {
  el.classList.add("is-pressed");
  window.setTimeout(() => el.classList.remove("is-pressed"), 100);
  try {
    navigator.vibrate?.(10);
  } catch {
    /* optional */
  }
}

function PinPad({
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
  const dotsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shaking) return;
    const t = window.setTimeout(() => setShaking(false), 650);
    return () => window.clearTimeout(t);
  }, [shaking]);

  useEffect(() => {
    syncDots(dotsRef.current, digits.length);
  }, [digits]);

  const push = useCallback(
    (d: string, btn?: HTMLElement | null) => {
      if (busyRef.current) return;
      if (btn) pressFlash(btn);
      const next = (digitsRef.current + d).slice(0, 4);
      digitsRef.current = next;
      // Paint dots immediately — do not wait for React/Pixi parent work.
      syncDots(dotsRef.current, next.length);
      setDigits(next);
      setError("");
      if (next.length === 4) {
        setBusy(true);
        busyRef.current = true;
        onSubmit(next)
          .catch((err) => {
            setError(err instanceof Error ? err.message : "Wrong PIN");
            setDigits("");
            digitsRef.current = "";
            syncDots(dotsRef.current, 0);
            setShaking(true);
          })
          .finally(() => {
            setBusy(false);
            busyRef.current = false;
          });
      }
    },
    [onSubmit],
  );

  const backspace = useCallback((btn?: HTMLElement | null) => {
    if (busyRef.current) return;
    if (btn) pressFlash(btn);
    const next = digitsRef.current.slice(0, -1);
    digitsRef.current = next;
    syncDots(dotsRef.current, next.length);
    setDigits(next);
  }, []);

  const onDigitDown = (d: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    push(d, e.currentTarget);
  };

  const node = (
    <div className="pin-backdrop" onClick={onCancel} role="presentation">
      <TitleChrome />
      <div
        className="pin-buffer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`pin-card ${busy ? "busy" : ""} ${shaking ? "pin-shake" : ""}`}
          role="dialog"
          aria-label="Enter PIN"
          aria-busy={busy || undefined}
        >
          <SignChrome name={name} />
          <p className="sheet-lede">Enter your 4-digit PIN</p>
          <div className="dots" ref={dotsRef} aria-live="polite" aria-atomic="true">
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
                aria-label={`Digit ${d}`}
                onPointerDown={onDigitDown(d)}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              className="pad-act"
              aria-label="Cancel"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                pressFlash(e.currentTarget);
              }}
              onClick={onCancel}
            >
              ✕
            </button>
            <button
              type="button"
              className="pad-num"
              aria-label="Digit 0"
              onPointerDown={onDigitDown("0")}
            >
              0
            </button>
            <button
              type="button"
              className="pad-act"
              aria-label="Delete last digit"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                backspace(e.currentTarget);
              }}
            >
              ⌫
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export default memo(PinPad);
