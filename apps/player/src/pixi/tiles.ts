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

export function createFarmMap(tileset: Texture, width = 36, height = 20): TiledMap {
  const resolved = createMap({
    width,
    height,
    tilewidth: 64,
    tileheight: 64,
    orientation: "orthogonal",
    tilesets: [
      {
        name: "soil",
        image: "soil",
        tilewidth: 64,
        tileheight: 64,
        tilecount: 16,
        columns: 4,
        imagewidth: 256,
        imageheight: 256,
      },
    ],
    layers: [
      {
        name: "ground",
        parallaxx: 0.42,
        parallaxy: 0.42,
        tiles: fill(width, height, (x, y) => {
          if (y > height - 4 && x > width - 8) return 6;
          if ((x + y) % 11 === 0) return 7;
          if (y === height - 6 && x > 8 && x < width - 6) return 5;
          if ((x * 3 + y * 7) % 13 === 0) return 1;
          if ((x * 5 + y) % 17 === 0) return 2;
          return 0;
        }),
      },
      {
        name: "detail",
        parallaxx: 0.55,
        parallaxy: 0.55,
        tiles: fill(width, height, (x, y) => {
          if ((x * 13 + y * 3) % 29 === 0 && y > 8) return 7;
          if ((x + y * 2) % 23 === 0 && y > 10) return 10;
          return null;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["soil", tileset]]) });
}

export function createGardenMap(tileset: Texture, width = 24, height = 14): TiledMap {
  const resolved = createMap({
    width,
    height,
    tilewidth: 64,
    tileheight: 64,
    orientation: "orthogonal",
    tilesets: [
      {
        name: "soil",
        image: "soil",
        tilewidth: 64,
        tileheight: 64,
        tilecount: 16,
        columns: 4,
        imagewidth: 256,
        imageheight: 256,
      },
    ],
    layers: [
      {
        name: "ground",
        parallaxx: 0.3,
        parallaxy: 0.3,
        tiles: fill(width, height, (x, y) => {
          const inPlot = x >= 6 && x <= 17 && y >= 4 && y <= 10;
          if (inPlot) return (x + y) % 2 === 0 ? 4 : 3;
          if ((x + y) % 9 === 0) return 7;
          return y % 3 === 0 ? 1 : 0;
        }),
      },
    ],
  });
  return new TiledMap(resolved, { tilesetTextures: new Map([["soil", tileset]]) });
}
