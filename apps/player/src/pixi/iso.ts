/** Tiled isometric diamond: Kenney miniature farm scaled to 128×256 sprites. */
export const TILE_W = 128;
export const TILE_H = 64;

export function isoToScreen(col: number, row: number, tw = TILE_W, th = TILE_H) {
  return {
    x: (col - row) * (tw / 2),
    y: (col + row) * (th / 2),
  };
}

export function isoDepth(col: number, row: number) {
  return col + row;
}
