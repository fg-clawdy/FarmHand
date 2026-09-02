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
    tilecount: 8,
    columns: 4,
    imagewidth: 512,
    imageheight: 512,
  };
}

function inRect(x: number, y: number, rect: PlotRect) {
  return x >= rect.c0 && x <= rect.c1 && y >= rect.r0 && y <= rect.r1;
}

/** Shared homestead gardens on the dashboard (3×2 beds). Fence is a separate overlay. */
export const FARM_PLOTS: PlotRect = { c0: 4, r0: 2, c1: 6, r1: 3 };
/** One-tile grass margin around the beds so opposite rails aren't stacked. */
export const FARM_FENCE: PlotRect = { c0: 3, r0: 1, c1: 6, r1: 5 };
export const FARM_BARN = { col: 1, row: 6 };
export const FARM_STORE = { col: 8, row: 1 };

export function createFarmMap(tileset: Texture, width = 12, height = 12): TiledMap {
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
          if (y === 6 && x > 2 && x < width - 3) return TILE_ID.hay;
          if ((x + y) % 11 === 0) return TILE_ID.dirt;
          return TILE_ID.grass;
        }),
      },
      {
        name: "detail",
        tiles: fill(width, height, (x, y) => {
          if (x === 3 && y === 7) return TILE_ID.hayBales;
          if (x === 9 && y === 6) return TILE_ID.crate;
          if (x === 2 && y === 2) return TILE_ID.sack;
          return null;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["iso", tileset]]) });
}

/** Inclusive tile rect covering the six playable garden slots. */
export const GARDEN_PLOT_RECT: PlotRect = { c0: 3, r0: 2, c1: 5, r1: 3 };
export const GARDEN_FENCE: PlotRect = { c0: 2, r0: 1, c1: 6, r1: 4 };

export function createGardenMap(tileset: Texture, width = 10, height = 8): TiledMap {
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
          if (y === 5 && x > 1 && x < width - 2) return TILE_ID.hay;
          return TILE_ID.grass;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["iso", tileset]]) });
}

export const GARDEN_PLOTS: Array<[number, number]> = [
  [3, 2],
  [4, 2],
  [5, 2],
  [3, 3],
  [4, 3],
  [5, 3],
];
