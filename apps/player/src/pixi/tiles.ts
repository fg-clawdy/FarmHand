import { createMap, TiledMap } from "pixi-tiledmap";
import type { Texture } from "pixi.js";
import { TILE_H, TILE_W } from "./iso";
import { TILE_ID } from "./atlas";
import type { PlotRect } from "./fenceLayout";

function fill(width: number, height: number, pick: (x: number, y: number) => number | null) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = pick(x, y);
      tiles.push(id == null ? null : { tileset: "iso", tileId: id });
    }
  }
  return tiles;
}

function isoTileset() {
  return {
    name: "iso",
    image: "iso",
    tilewidth: TILE_W,
    tileheight: 256,
    tilecount: 4,
    columns: 2,
    imagewidth: 256,
    imageheight: 512,
  };
}

function inRect(x: number, y: number, rect: PlotRect) {
  return x >= rect.c0 && x <= rect.c1 && y >= rect.r0 && y <= rect.r1;
}

/**
 * Homestead cluster sits in the middle of a large generated grass diamond so
 * tiles reach the viewport edges. Relative barn/store/plot spacing is unchanged.
 */
export const FARM_SHIFT = 14;
/** Shared homestead gardens on the dashboard (3×2 beds). Fence is a separate overlay. */
export const FARM_PLOTS: PlotRect = { c0: 4 + FARM_SHIFT, r0: 2 + FARM_SHIFT, c1: 6 + FARM_SHIFT, r1: 3 + FARM_SHIFT };
/** One-tile grass margin around the beds so opposite rails aren't stacked. */
export const FARM_FENCE: PlotRect = { c0: 3 + FARM_SHIFT, r0: 1 + FARM_SHIFT, c1: 6 + FARM_SHIFT, r1: 5 + FARM_SHIFT };
export const FARM_BARN = { col: 1 + FARM_SHIFT, row: 6 + FARM_SHIFT };
export const FARM_STORE = { col: 8 + FARM_SHIFT, row: 1 + FARM_SHIFT };
export const FARM_MAP = { width: 40, height: 40 };

/** Painted props sitting on the iso ground (not a filled fence wall). */
export const FARM_PROPS: Array<{ frame: string; col: number; row: number; scale?: number }> = [
  { frame: "prop_bales_stacked", col: 3 + FARM_SHIFT, row: 8 + FARM_SHIFT, scale: 0.72 },
  { frame: "prop_hay", col: 2 + FARM_SHIFT, row: 9 + FARM_SHIFT, scale: 0.7 },
  { frame: "prop_barrel", col: 5 + FARM_SHIFT, row: 10 + FARM_SHIFT, scale: 0.68 },
  { frame: "prop_crate", col: 10 + FARM_SHIFT, row: 5 + FARM_SHIFT, scale: 0.7 },
  { frame: "prop_crate", col: 9 + FARM_SHIFT, row: 7 + FARM_SHIFT, scale: 0.7 },
  { frame: "prop_sack", col: 2 + FARM_SHIFT, row: 4 + FARM_SHIFT, scale: 0.68 },
  { frame: "prop_bush", col: 11 + FARM_SHIFT, row: 3 + FARM_SHIFT, scale: 0.75 },
  { frame: "prop_sack", col: 7 + FARM_SHIFT, row: 9 + FARM_SHIFT, scale: 0.68 },
  { frame: "prop_hay", col: 6 + FARM_SHIFT, row: 8 + FARM_SHIFT, scale: 0.7 },
  { frame: "prop_bales_stacked", col: 14 + FARM_SHIFT, row: 7 + FARM_SHIFT, scale: 0.72 },
  { frame: "prop_crate", col: 13 + FARM_SHIFT, row: 11 + FARM_SHIFT, scale: 0.7 },
  { frame: "prop_barrel", col: 16 + FARM_SHIFT, row: 9 + FARM_SHIFT, scale: 0.68 },
  { frame: "prop_bush", col: 12 + FARM_SHIFT, row: 14 + FARM_SHIFT, scale: 0.75 },
  { frame: "prop_ladder", col: 1 + FARM_SHIFT, row: 5 + FARM_SHIFT, scale: 0.7 },
];

export function createFarmMap(tileset: Texture, width = FARM_MAP.width, height = FARM_MAP.height): TiledMap {
  const resolved = createMap({
    width,
    height,
    tilewidth: TILE_W,
    tileheight: TILE_H,
    orientation: "isometric",
    tilesets: [isoTileset()],
    layers: [
      {
        name: "ground",
        tiles: fill(width, height, (x, y) => {
          if (inRect(x, y, FARM_PLOTS)) return TILE_ID.farmland;
          if ((y === 8 + FARM_SHIFT || y === 15 + FARM_SHIFT) && x > 2 && x < width - 3) return TILE_ID.path;
          if (x === 17 + FARM_SHIFT && y > 4 && y < height - 3) return TILE_ID.path;
          if ((x + 3 * y) % 8 === 0) return TILE_ID.dirt;
          return TILE_ID.grass;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["iso", tileset]]) });
}

/** Inclusive tile rect covering the six playable garden slots. */
export const GARDEN_SHIFT = 10;
export const GARDEN_PLOT_RECT: PlotRect = {
  c0: 3 + GARDEN_SHIFT,
  r0: 2 + GARDEN_SHIFT,
  c1: 5 + GARDEN_SHIFT,
  r1: 3 + GARDEN_SHIFT,
};
export const GARDEN_FENCE: PlotRect = { c0: 2 + GARDEN_SHIFT, r0: 1 + GARDEN_SHIFT, c1: 6 + GARDEN_SHIFT, r1: 4 + GARDEN_SHIFT };
export const GARDEN_MAP = { width: 36, height: 28 };
export const GARDEN_PROPS: Array<{ frame: string; col: number; row: number; scale?: number }> = [
  { frame: "prop_bales_stacked", col: 1 + GARDEN_SHIFT, row: 6 + GARDEN_SHIFT, scale: 0.72 },
  { frame: "prop_bush", col: 8 + GARDEN_SHIFT, row: 6 + GARDEN_SHIFT, scale: 0.75 },
  { frame: "prop_sack", col: 9 + GARDEN_SHIFT, row: 3 + GARDEN_SHIFT, scale: 0.68 },
  { frame: "prop_crate", col: 10 + GARDEN_SHIFT, row: 7 + GARDEN_SHIFT, scale: 0.7 },
  { frame: "prop_hay", col: 4 + GARDEN_SHIFT, row: 7 + GARDEN_SHIFT, scale: 0.7 },
];

export function createGardenMap(tileset: Texture, width = GARDEN_MAP.width, height = GARDEN_MAP.height): TiledMap {
  const resolved = createMap({
    width,
    height,
    tilewidth: TILE_W,
    tileheight: TILE_H,
    orientation: "isometric",
    tilesets: [isoTileset()],
    layers: [
      {
        name: "ground",
        tiles: fill(width, height, (x, y) => {
          if (inRect(x, y, GARDEN_PLOT_RECT)) return TILE_ID.farmland;
          if ((y === 6 + GARDEN_SHIFT || y === 9 + GARDEN_SHIFT) && x > 1 && x < width - 2) return TILE_ID.path;
          if ((x + 3 * y) % 7 === 0) return TILE_ID.dirt;
          return TILE_ID.grass;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["iso", tileset]]) });
}

export const GARDEN_PLOTS: Array<[number, number]> = [
  [3 + GARDEN_SHIFT, 2 + GARDEN_SHIFT],
  [4 + GARDEN_SHIFT, 2 + GARDEN_SHIFT],
  [5 + GARDEN_SHIFT, 2 + GARDEN_SHIFT],
  [3 + GARDEN_SHIFT, 3 + GARDEN_SHIFT],
  [4 + GARDEN_SHIFT, 3 + GARDEN_SHIFT],
  [5 + GARDEN_SHIFT, 3 + GARDEN_SHIFT],
];
