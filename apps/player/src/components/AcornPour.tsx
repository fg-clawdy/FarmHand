import { useEffect, useMemo, useRef, useState } from "react";
import { AcornArt } from "../art";
import { STAR_FLIGHT_S, starLaunchDelay, starPourDuration } from "./starPourPace";

type Acorn = {
  id: string;
  delay: number;
  dx: number;
  dy: number;
};

/**
 * One acorn per seed earned on chore claim. Leaves the confirm sheet origin
 * and shrinks into the garden header seed meter (same pace as StarPour).
 */
export default function AcornPour({
  seeds,
  from,
  to,
  onArrive,
  onDone,
}: {
  seeds: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  onArrive?: (arrived: number, total: number) => void;
  onDone: () => void;
}) {
  const count = Math.max(0, Math.round(seeds));
  const acorns = useMemo<Acorn[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: `acorn-${i}`,
      delay: starLaunchDelay(i, count),
      dx: ((i % 7) - 3) * 10,
      dy: -12 - (i % 4) * 6,
    }));
  }, [count]);
  const [gone, setGone] = useState(false);
  const onArriveRef = useRef(onArrive);
  const onDoneRef = useRef(onDone);
  onArriveRef.current = onArrive;
  onDoneRef.current = onDone;

  useEffect(() => {
    if (count === 0) {
      onDoneRef.current();
      return;
    }
    const timers: number[] = [];
    acorns.forEach((acorn, i) => {
      timers.push(
        window.setTimeout(() => onArriveRef.current?.(i + 1, count), (acorn.delay + STAR_FLIGHT_S) * 1000),
      );
    });
    timers.push(
      window.setTimeout(() => {
        setGone(true);
        onDoneRef.current();
      }, starPourDuration(count) * 1000 + 40),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [acorns, count]);

  if (gone || count === 0) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <div className="acorn-pour" aria-hidden="true" data-seeds={count}>
      {acorns.map((acorn) => (
        <span
          key={acorn.id}
          className="acorn-pour-acorn"
          style={{
            left: from.x + acorn.dx,
            top: from.y + acorn.dy,
            animationDelay: `${acorn.delay}s`,
            ["--flight" as string]: `${STAR_FLIGHT_S}s`,
            ["--pour-x" as string]: `${dx - acorn.dx}px`,
            ["--pour-y" as string]: `${dy - acorn.dy}px`,
          }}
        >
          <AcornArt className="acorn-pour-icon" />
        </span>
      ))}
    </div>
  );
}
