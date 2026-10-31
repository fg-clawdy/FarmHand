export type BalloonJob = {
  goalId: string;
  title: string;
  cost: number;
  from: number;
  to: number;
};

export type MeadowGoal = {
  id: string;
  title: string;
  cost: number;
  filled: number;
};

/**
 * Line up a confirmed donation behind any gift already queued for that goal.
 * The next animation starts from the previous gift's end, which is the server
 * total once every queued gift has been applied.
 */
export function enqueueDonation(queue: readonly BalloonJob[], job: BalloonJob): BalloonJob[] {
  const earlier = queue.filter((item) => item.goalId === job.goalId);
  const from = earlier.length > 0 ? earlier[earlier.length - 1]!.to : job.from;
  const to = Math.max(from, Math.min(job.cost, job.to));
  if (to <= from) return [...queue];
  return [...queue, { ...job, from, to }];
}

/**
 * Stars the bunch should show. While a goal is animating or queued, keep the
 * visual start of that chain. Otherwise trust the server.
 */
export function displayFilled(
  goalId: string,
  serverFilled: number,
  queue: readonly BalloonJob[],
  playing: BalloonJob | null,
): number {
  if (playing?.goalId === goalId) return playing.from;
  const queued = queue.find((item) => item.goalId === goalId);
  if (queued) return queued.from;
  return serverFilled;
}

/**
 * Keep the bunch that is on screen if the server drops that goal mid-flight.
 * Once the animation is resting, the meadow matches the latest server list.
 */
export function meadowDuringPlayback(
  goals: readonly MeadowGoal[],
  job: BalloonJob | null,
  playing: boolean,
  previous: readonly MeadowGoal[] = [],
): MeadowGoal[] {
  if (!playing || !job || goals.some((goal) => goal.id === job.goalId)) return [...goals];
  const prior = previous.find((goal) => goal.id === job.goalId);
  const held: MeadowGoal = prior ?? {
    id: job.goalId,
    title: job.title,
    cost: job.cost,
    filled: job.from,
  };
  const index = previous.findIndex((goal) => goal.id === job.goalId);
  const next = [...goals];
  next.splice(index >= 0 ? Math.min(index, next.length) : 0, 0, held);
  return next;
}
