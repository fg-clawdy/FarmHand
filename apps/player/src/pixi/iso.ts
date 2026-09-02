/** Tiled isometric diamond: Kenney miniature farm scaled to 128×256 sprites. */
export const TILE_W = 128;
export const TILE_H = 64;
/** Kenney iso sprites are packed 128×256; extra height sits above the diamond. */
export const TILE_SPRITE_H = 256;

export function isoToScreen(col: number, row: number, tw = TILE_W, th = TILE_H) {
  return {
    x: (col - row) * (tw / 2),
    y: (col + row) * (th / 2),
  };
}

/** Center of the iso diamond — sit props/animals here (matches Kenney tile ground). */
export function isoGround(col: number, row: number, tw = TILE_W, th = TILE_H) {
  const p = isoToScreen(col, row, tw, th);
  return { x: p.x + tw / 2, y: p.y + th / 2 };
}

export function isoDepth(col: number, row: number) {
  return col + row;
}
