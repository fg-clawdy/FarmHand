/** Flight time for one star, from basket to the points meter. */
export const STAR_FLIGHT_S = 1.35;

const SLOW_GAP_S = 0.2;
const FAST_GAP_S = 0.03;
const EDGE_STARS = 10;

/** Gap after star `k` in a stream of `count` stars. */
export function starGap(k: number, count: number) {
  const n = Math.max(1, count);
  if (n <= EDGE_STARS * 2) return SLOW_GAP_S;
  if (k < EDGE_STARS) {
    return SLOW_GAP_S + (FAST_GAP_S - SLOW_GAP_S) * (k / EDGE_STARS);
  }
  const tailStart = n - 1 - EDGE_STARS;
  if (k >= tailStart) {
    const intoTail = k - tailStart + 1;
    return FAST_GAP_S + (SLOW_GAP_S - FAST_GAP_S) * (intoTail / EDGE_STARS);
  }
  return FAST_GAP_S;
}

/**
 * Launch time of star `index` in a stream of `count`.
 * First and last 10 are slow. The middle runs faster.
 * A sale of 20 stars or fewer stays slow the whole way.
 */
export function starLaunchDelay(index: number, count: number) {
  const n = Math.max(1, count);
  const i = Math.min(Math.max(0, index), n - 1);
  let t = 0;
  for (let k = 0; k < i; k++) t += starGap(k, n);
  return t;
}

/** When the last star has finished shrinking into the meter. */
export function starPourDuration(count: number) {
  return starLaunchDelay(Math.max(0, count - 1), count) + STAR_FLIGHT_S;
}
