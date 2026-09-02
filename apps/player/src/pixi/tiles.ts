import { createMap, TiledMap } from "pixi-tiledmap";
import type { Texture } from "pixi.js";
import { TILE_H, TILE_W } from "./iso";
import { TILE_ID } from "./atlas";

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

export function createFarmMap(tileset: Texture, width = 14, height = 14): TiledMap {
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
          if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) return TILE_ID.fence;
          if (x >= 5 && x <= 9 && y >= 5 && y <= 8) return TILE_ID.farmland;
          if (y === 10 && x > 2 && x < width - 3) return TILE_ID.hay;
          if ((x + y) % 11 === 0) return TILE_ID.dirt;
          return TILE_ID.grass;
        }),
      },
      {
        name: "detail",
        tiles: fill(width, height, (x, y) => {
          if (x === 3 && y === 11) return TILE_ID.hayBales;
          if (x === 11 && y === 11) return TILE_ID.crate;
          if (x === 4 && y === 4) return TILE_ID.sack;
          return null;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["iso", tileset]]) });
}

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
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return TILE_ID.fence;
          const inPlot = x >= 3 && x <= 6 && y >= 2 && y <= 4;
          if (inPlot) return TILE_ID.farmland;
          if (y === 6 && x > 1 && x < width - 2) return TILE_ID.hay;
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
