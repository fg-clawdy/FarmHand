import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "pointermove",
  "touchstart",
  "touchmove",
  "keydown",
  "scroll",
  "wheel",
];

/**
 * After `ms` of no user activity on a garden route: end the kid session and return to Farm.
 * Gardens appear locked again (PIN required to re-enter).
 */
export function useGardenIdleLock(ms = 90_000) {
  const navigate = useNavigate();
  const locking = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const lock = () => {
      if (locking.current) return;
      locking.current = true;
      void api
        .logout()
        .catch(() => undefined)
        .finally(() => {
          navigate("/", { replace: true });
        });
    };

    const reset = () => {
      if (locking.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(lock, ms);
    };

    reset();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, reset, { passive: true });
    }

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, reset);
      }
    };
  }, [ms, navigate]);
}
