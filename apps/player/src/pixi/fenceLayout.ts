export type PlotRect = { c0: number; r0: number; c1: number; r1: number };

export type FencePost = { col: number; row: number; flipX: boolean };

/**
 * One contiguous iso perimeter around an inclusive plot rect.
 * Kenney `fenceLow` runs along the SW diamond edge; a horizontal flip is the SE edge.
 * West/east get a single SW column each; north/south get a single SE row each.
 * Corners get both pieces so the segments meet. Never fills the interior.
 */
export function fencePosts(rect: PlotRect): FencePost[] {
  const { c0, r0, c1, r1 } = rect;
  const west = c0 - 1;
  const east = c1 + 1;
  const north = r0 - 1;
  const south = r1 + 1;
  const posts: FencePost[] = [];

  for (let r = r0; r <= r1; r++) {
    posts.push({ col: west, row: r, flipX: false });
    posts.push({ col: east, row: r, flipX: false });
  }
  for (let c = c0; c <= c1; c++) {
    posts.push({ col: c, row: north, flipX: true });
    posts.push({ col: c, row: south, flipX: true });
  }
  for (const [col, row] of [
    [west, north],
    [east, north],
    [west, south],
    [east, south],
  ] as const) {
    posts.push({ col, row, flipX: false });
    posts.push({ col, row, flipX: true });
  }
  return posts;
}

export function fenceTouchesInterior(posts: FencePost[], rect: PlotRect) {
  return posts.some((p) => p.col >= rect.c0 && p.col <= rect.c1 && p.row >= rect.r0 && p.row <= rect.r1);
}
