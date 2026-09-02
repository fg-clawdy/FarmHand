import { createMap, TiledMap } from "pixi-tiledmap";
import type { Texture } from "pixi.js";

function fill(width: number, height: number, pick: (x: number, y: number) => number | null) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = pick(x, y);
      tiles.push(id == null ? null : { tileset: "soil", tileId: id });
    }
  }
  return tiles;
}

function soilTileset() {
  return {
    name: "soil",
    image: "soil",
    tilewidth: 64,
    tileheight: 64,
    tilecount: 16,
    columns: 4,
    imagewidth: 256,
    imageheight: 256,
  };
}

/** Painted backdrop carries the hills; tiles only add path, flowers, and a pond. */
export function createFarmMap(tileset: Texture, width = 36, height = 20): TiledMap {
  const resolved = createMap({
    width,
    height,
    tilewidth: 64,
    tileheight: 64,
    orientation: "orthogonal",
    tilesets: [soilTileset()],
    layers: [
      {
        name: "ground",
        parallaxx: 0.35,
        parallaxy: 0.35,
        tiles: fill(width, height, (x, y) => {
          if (y > height - 5 && x > width - 9) return 6;
          if (y === height - 7 && x > 4 && x < width - 5) return 5;
          if (y === height - 6 && x > 6 && x < width - 7) return 5;
          return null;
        }),
      },
      {
        name: "detail",
        parallaxx: 0.55,
        parallaxy: 0.55,
        tiles: fill(width, height, (x, y) => {
          if (y < height - 10) return null;
          if ((x * 13 + y * 3) % 17 === 0) return 7;
          if ((x + y * 2) % 19 === 0) return 10;
          return null;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["soil", tileset]]) });
}

/** Tilled bed under the 2×3 plots; grass/flowers only as a sparse rim. */
export function createGardenMap(tileset: Texture, width = 24, height = 14): TiledMap {
  const resolved = createMap({
    width,
    height,
    tilewidth: 64,
    tileheight: 64,
    orientation: "orthogonal",
    tilesets: [soilTileset()],
    layers: [
      {
        name: "ground",
        parallaxx: 0.22,
        parallaxy: 0.22,
        tiles: fill(width, height, (x, y) => {
          const inPlot = x >= 6 && x <= 17 && y >= 4 && y <= 10;
          if (inPlot) return (x + y) % 2 === 0 ? 4 : 3;
          if (y >= 3 && y <= 11 && x >= 5 && x <= 18) return 0;
          if ((x + y) % 9 === 0 && y > 2) return 7;
          return null;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["soil", tileset]]) });
}
