import { Rectangle, Texture } from "pixi.js";
import { canvas, fitImage, imageCanvas, loadImage } from "./draw";

export type Atlas = {
  texture: Texture;
  frame: (name: string) => Texture;
  animation: (name: string) => Texture[];
};

export const ANIMS = ["sit", "lay", "walk", "run", "eat"] as const;
export type AnimalAction = (typeof ANIMS)[number];
export const ANIMAL_KINDS = ["cow", "chicken", "pig", "sheep", "horse"] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];
export const CROP_KINDS = ["daisy", "herbs", "sunflower", "oak"] as const;
export type CropKind = (typeof CROP_KINDS)[number];

const GEN = "/art/generated";

const TILE_KEYS = ["grass", "dirt", "farmland", "path"] as const;
export type TileKey = (typeof TILE_KEYS)[number];
export const TILE_ID: Record<TileKey, number> = {
  grass: 0,
  dirt: 1,
  farmland: 2,
  path: 3,
};

async function gen(path: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(`${GEN}/${path}`);
  return imageCanvas(img);
}

function particleDot() {
  const [c, ctx] = canvas(24, 24);
  const g = ctx.createRadialGradient(12, 12, 1, 12, 12, 12);
  g.addColorStop(0, "#fff");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 24, 24);
  return c;
}

function glowDot() {
  const [c, ctx] = canvas(96, 96);
  const g = ctx.createRadialGradient(48, 48, 8, 48, 48, 48);
  g.addColorStop(0, "rgba(255,229,106,0.85)");
  g.addColorStop(1, "rgba(255,229,106,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  return c;
}

function pack(frames: Map<string, HTMLCanvasElement>): Atlas {
  const list = [...frames.entries()];
  const pad = 2;
  let x = pad;
  let y = pad;
  let rowH = 0;
  const size = 4096;
  const [sheet, ctx] = canvas(size, size);
  const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const [name, img] of list) {
    if (x + img.width + pad > size) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    if (y + img.height + pad > size) continue;
    ctx.drawImage(img, x, y);
    rects.set(name, { x, y, w: img.width, h: img.height });
    x += img.width + pad;
    rowH = Math.max(rowH, img.height);
  }
  const base = Texture.from(sheet);
  const cache = new Map<string, Texture>();
  const frame = (name: string) => {
    const hit = cache.get(name);
    if (hit) return hit;
    const r = rects.get(name);
    if (!r) return Texture.EMPTY;
    const tex = new Texture({ source: base.source, frame: new Rectangle(r.x, r.y, r.w, r.h) });
    cache.set(name, tex);
    return tex;
  };
  return {
    texture: base,
    frame,
    animation(name: string) {
      const framesOut: Texture[] = [];
      for (let i = 0; i < 8; i++) {
        const key = `${name}_${i}`;
        if (!rects.has(key)) break;
        framesOut.push(frame(key));
      }
      return framesOut.length ? framesOut : [frame(name)];
    },
  };
}

function packTileset(tiles: HTMLCanvasElement[]): Texture {
  const tw = 128;
  const th = 256;
  const cols = 2;
  const rows = 2;
  const [c, ctx] = canvas(tw * cols, th * rows);
  tiles.forEach((tile, i) => {
    ctx.drawImage(fitImage(tile, tw, th), (i % cols) * tw, Math.floor(i / cols) * th);
  });
  return Texture.from(c);
}

export async function buildAtlas(): Promise<{ atlas: Atlas; tileset: Texture }> {
  const frames = new Map<string, HTMLCanvasElement>();
  const put = async (key: string, path: string) => {
    frames.set(key, await gen(path));
  };

  await Promise.all([
    put("tile_grass", "tiles/grass.png"),
    put("tile_dirt", "tiles/dirt.png"),
    put("tile_farmland", "tiles/farmland.png"),
    put("tile_path", "tiles/path.png"),
    put("prop_barn", "buildings/barn.png"),
    put("prop_store", "buildings/store.png"),
    put("prop_fence_sw", "fence/sw.png"),
    put("prop_fence_se", "fence/se.png"),
    put("prop_hay", "props/hay.png"),
    put("prop_bales", "props/hay.png"),
    put("prop_bales_stacked", "props/bales_stacked.png"),
    put("prop_sack", "props/sack.png"),
    put("prop_crate", "props/crate.png"),
    put("prop_barrel", "props/barrel.png"),
    put("prop_bush", "props/bush.png"),
    put("prop_ladder", "props/ladder.png"),
    put("prop_sign", "props/sign.png"),
    put("ui_can", "props/can.png"),
    put("ui_beaker", "props/beaker.png"),
    put("ui_acorn", "props/acorn.png"),
    put("backdrop_hills", "backdrop/hills.jpg"),
    ...CROP_KINDS.flatMap((kind) =>
      ([1, 2, 3, 4] as const).map((stage) => put(`crop_${kind}_${stage}`, `crops/${kind}_${stage}.png`)),
    ),
    ...ANIMAL_KINDS.flatMap((kind) =>
      ANIMS.flatMap((action) => {
        const n = action === "sit" || action === "lay" ? 4 : 6;
        return Array.from({ length: n }, (_, i) =>
          put(`animal_${kind}_${action}_${i}`, `animals/${kind}_${action}_${i}.png`),
        );
      }),
    ),
  ]);

  const tileset = packTileset([
    frames.get("tile_grass")!,
    frames.get("tile_dirt")!,
    frames.get("tile_farmland")!,
    frames.get("tile_path")!,
  ]);

  frames.set("fx_dot", particleDot());
  frames.set("fx_glow", glowDot());

  const atlas = pack(frames);
  return { atlas, tileset };
}

export function cropFrame(atlas: Atlas, kind: CropKind, stage: 1 | 2 | 3 | 4): Texture {
  return atlas.frame(`crop_${kind}_${stage}`);
}
