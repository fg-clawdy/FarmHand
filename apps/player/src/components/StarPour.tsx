import { useEffect, useMemo, useRef, useState } from "react";
import type { BasketItem } from "../api";
import { STAR_FLIGHT_S, starLaunchDelay, starPourDuration } from "./starPourPace";

type Star = {
  id: string;
  delay: number;
  dx: number;
  dy: number;
};

/**
 * One star per point. They leave the basket and shrink into the points meter.
 * Launch pace is slow, faster through the middle, slow again for the last stars.
 */
export default function StarPour({
  points,
  items,
  from,
  to,
  onArrive,
  onDone,
}: {
  /** Stars to spawn. This is the sold point total, not the plant count. */
  points: number;
  items?: BasketItem[];
  from: { x: number; y: number };
  to: { x: number; y: number };
  onArrive?: (arrived: number, total: number) => void;
  onDone: () => void;
}) {
  const count = Math.max(0, Math.round(points));
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: `star-${i}`,
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
    stars.forEach((star, i) => {
      timers.push(window.setTimeout(() => onArriveRef.current?.(i + 1, count), (star.delay + STAR_FLIGHT_S) * 1000));
    });
    timers.push(window.setTimeout(() => {
      setGone(true);
      onDoneRef.current();
    }, starPourDuration(count) * 1000 + 40));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [stars, count]);

  if (gone || count === 0) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <div className="star-pour" aria-hidden="true" data-points={count} data-plants={items?.length ?? 0}>
      {stars.map((star) => (
        <span
          key={star.id}
          className="star-pour-star"
          style={{
            left: from.x + star.dx,
            top: from.y + star.dy,
            animationDelay: `${star.delay}s`,
            ["--flight" as string]: `${STAR_FLIGHT_S}s`,
            ["--pour-x" as string]: `${dx - star.dx}px`,
            ["--pour-y" as string]: `${dy - star.dy}px`,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
