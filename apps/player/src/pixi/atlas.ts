import { Rectangle, Texture } from "pixi.js";
import { BIBLE, canvas, fitImage, imageCanvas, loadImage } from "./draw";

export type Atlas = {
  texture: Texture;
  frame: (name: string) => Texture;
  animation: (name: string) => Texture[];
};

export const ANIMS = ["sit", "lay", "walk", "run", "eat"] as const;
export type AnimalAction = (typeof ANIMS)[number];
/** Vendor Animal Pack Redux files we actually ship (no sheep still). */
export const ANIMAL_KINDS = ["cow", "pig", "chicken", "duck", "horse"] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];
export const CROP_KINDS = ["daisy", "herbs", "sunflower", "oak"] as const;
export type CropKind = (typeof CROP_KINDS)[number];

const KENNEY = "/art/vendor/kenney/iso-miniature-farm";

const TILE_KEYS = [
  "grass",
  "dirt",
  "farmland",
  "hay",
  "hayBales",
  "fence",
  "sack",
  "crate",
] as const;
export type TileKey = (typeof TILE_KEYS)[number];
export const TILE_ID: Record<TileKey, number> = {
  grass: 0,
  dirt: 1,
  farmland: 2,
  hay: 3,
  hayBales: 4,
  fence: 5,
  sack: 6,
  crate: 7,
};

async function kenney(name: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(`${KENNEY}/${name}_N.png`);
  return imageCanvas(img);
}

function recolor(src: HTMLCanvasElement, fn: (r: number, g: number, b: number, a: number) => [number, number, number, number]) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const [r, g, b, a] = fn(d[i], d[i + 1], d[i + 2], d[i + 3]);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = a;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function dirtToGrass(src: HTMLCanvasElement) {
  return recolor(src, (r, g, b, a) => {
    const lum = (r + g + b) / 3;
    // Only the Kenney dirt top-face — keep the brown side facets so diamonds read as tiles.
    const isTop = lum > 100 && r > 90 && g > 70 && Math.abs(r - g) < 55 && r + 20 > b;
    if (!isTop) return [r, g, b, a];
    return [
      Math.min(255, 55 + lum * 0.32),
      Math.min(255, 135 + lum * 0.42),
      Math.min(255, 40 + lum * 0.12),
      a,
    ];
  });
}

function cropTint(src: HTMLCanvasElement, kind: CropKind) {
  if (kind === "herbs") {
    return recolor(src, (r, g, b, a) => [r * 0.75, Math.min(255, g * 1.15 + 12), b * 0.7, a]);
  }
  if (kind === "sunflower") {
    return recolor(src, (r, g, b, a) => {
      if (g > r && g > 80) return [Math.min(255, r + 50), Math.min(255, g + 10), Math.max(0, b - 20), a];
      return [Math.min(255, r + 18), g, b, a];
    });
  }
  if (kind === "daisy") {
    return recolor(src, (r, g, b, a) => {
      if (g > 90 && g >= r) return [Math.min(255, r + 40), Math.min(255, g + 8), Math.min(255, b + 30), a];
      return [r, g, b, a];
    });
  }
  return recolor(src, (r, g, b, a) => [Math.min(255, r * 0.85 + 20), Math.min(255, g * 0.95), b * 0.7, a]);
}

function overlayOak(src: HTMLCanvasElement) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = "#3f8a3a";
  ctx.beginPath();
  ctx.ellipse(src.width * 0.5, src.height * 0.42, 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f6a2c";
  ctx.beginPath();
  ctx.ellipse(src.width * 0.42, src.height * 0.46, 18, 12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function overlayDaisy(src: HTMLCanvasElement) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = "#fffdf6";
  for (const [x, y] of [
    [0.42, 0.34],
    [0.55, 0.32],
    [0.48, 0.4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(src.width * x, src.height * y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffc84a";
    ctx.beginPath();
    ctx.arc(src.width * x, src.height * y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffdf6";
  }
  return c;
}

function seedOn(farmland: HTMLCanvasElement) {
  const [c, ctx] = canvas(farmland.width, farmland.height);
  ctx.drawImage(farmland, 0, 0);
  ctx.fillStyle = "#a85a22";
  ctx.beginPath();
  ctx.ellipse(farmland.width * 0.5, farmland.height * 0.72, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BIBLE.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return c;
}

function flipH(src: HTMLCanvasElement) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function stack(layers: HTMLCanvasElement[]) {
  const w = Math.max(...layers.map((l) => l.width));
  const h = Math.max(...layers.map((l) => l.height));
  const [c, ctx] = canvas(w, h);
  for (const layer of layers) ctx.drawImage(layer, (w - layer.width) / 2, h - layer.height);
  return c;
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

const ANIMAL_FILE: Record<AnimalKind, string> = {
  cow: "cow",
  pig: "pig",
  chicken: "chicken",
  duck: "duck",
  horse: "horse",
};

/** Pack has stills only. Walk/eat bob the Kenney frame; sit/lay/run reuse — see ATTRIBUTION. */
function stampAnimal(still: HTMLCanvasElement, action: "walk" | "eat" | "idle", frame: number): HTMLCanvasElement {
  const [c, ctx] = canvas(96, 96);
  const t = (frame / 6) * Math.PI * 2;
  const bob = action === "walk" ? Math.abs(Math.sin(t)) * 5 : action === "eat" ? 7 + Math.sin(t) * 2 : Math.sin(t) * 1.2;
  ctx.fillStyle = "rgba(26,36,16,0.22)";
  ctx.beginPath();
  ctx.ellipse(48, 86, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(still, 8, 6 + bob, 80, 80);
  return c;
}

function pack(frames: Map<string, HTMLCanvasElement>): Atlas {
  const list = [...frames.entries()];
  const pad = 2;
  let x = pad;
  let y = pad;
  let rowH = 0;
  const size = 2048;
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
  const cols = 4;
  const rows = 2;
  const [c, ctx] = canvas(tw * cols, th * rows);
  tiles.forEach((tile, i) => {
    ctx.drawImage(fitImage(tile, tw, th), (i % cols) * tw, Math.floor(i / cols) * th);
  });
  return Texture.from(c);
}

export async function buildAtlas(): Promise<{ atlas: Atlas; tileset: Texture }> {
  const frames = new Map<string, HTMLCanvasElement>();
  const k = async (key: string, file: string) => {
    frames.set(key, await kenney(file));
  };
  await Promise.all([
    k("k_dirt", "dirt"),
    k("k_farmland", "dirtFarmland"),
    k("k_young", "cornYoung"),
    k("k_young2", "cornYoungDouble"),
    k("k_corn", "corn"),
    k("k_double", "cornDouble"),
    k("k_hay", "hay"),
    k("k_bales", "hayBales"),
    k("k_bales2", "hayBalesStacked"),
    k("k_fence", "fenceLow"),
    k("k_sack", "sack"),
    k("k_crate", "sacksCrate"),
    k("k_wall", "woodWall"),
    k("k_door", "woodWallDoorClosed"),
    k("k_window", "woodWallWindowGlass"),
    k("k_roof", "roof"),
    k("k_roofS", "roofSingle"),
    k("k_chimneyB", "chimneyBase"),
    k("k_chimneyT", "chimneyTop"),
    k("k_ladder", "ladderStraight"),
    k("k_planks", "planks"),
  ]);

  const dirt = frames.get("k_dirt")!;
  const farmland = frames.get("k_farmland")!;
  const grass = dirtToGrass(dirt);
  const tileset = packTileset([
    grass,
    dirt,
    farmland,
    frames.get("k_hay")!,
    frames.get("k_bales")!,
    frames.get("k_fence")!,
    frames.get("k_sack")!,
    frames.get("k_crate")!,
  ]);

  frames.set("prop_barn", stack([frames.get("k_wall")!, frames.get("k_roof")!, frames.get("k_chimneyB")!, frames.get("k_chimneyT")!]));
  frames.set("prop_store", stack([frames.get("k_door")!, frames.get("k_roofS")!, frames.get("k_crate")!]));
  frames.set("prop_fence_sw", frames.get("k_fence")!);
  frames.set("prop_fence_se", flipH(frames.get("k_fence")!));
  frames.set("prop_hay", frames.get("k_hay")!);
  frames.set("prop_bales", frames.get("k_bales")!);
  frames.set("prop_bales_stacked", frames.get("k_bales2")!);
  frames.set("prop_sack", frames.get("k_sack")!);
  frames.set("prop_crate", frames.get("k_crate")!);
  frames.set("prop_ladder", frames.get("k_ladder")!);
  frames.set("prop_planks", frames.get("k_planks")!);

  const hud = async (name: string, src: string, size: number) => {
    try {
      const img = await loadImage(src);
      frames.set(name, fitImage(img, size, size));
    } catch {
      /* HUD gap */
    }
  };
  await Promise.all([
    hud("ui_can", "/art/sprites/can.png", 96),
    hud("ui_beaker", "/art/sprites/beaker.png", 96),
    hud("ui_acorn", "/art/sprites/acorn.png", 72),
    hud("prop_sign", "/art/sprites/sign.png", 220),
  ]);

  const young = frames.get("k_young")!;
  const mid = frames.get("k_corn")!;
  const grown = frames.get("k_young2")!;
  const mature = frames.get("k_double")!;
  for (const kind of CROP_KINDS) {
    frames.set(`crop_${kind}_1`, seedOn(farmland));
    frames.set(`crop_${kind}_2`, cropTint(young, kind));
    frames.set(`crop_${kind}_3`, cropTint(kind === "herbs" ? grown : mid, kind));
    let ripe = cropTint(mature, kind);
    if (kind === "oak") ripe = overlayOak(ripe);
    if (kind === "daisy") ripe = overlayDaisy(ripe);
    frames.set(`crop_${kind}_4`, ripe);
  }

  frames.set("fx_dot", particleDot());
  frames.set("fx_glow", glowDot());

  await Promise.all(
    ANIMAL_KINDS.map(async (kind) => {
      const img = await loadImage(`/art/vendor/kenney/animals/${ANIMAL_FILE[kind]}.png`);
      const still = fitImage(img, 80, 80);
      for (let i = 0; i < 6; i++) {
        const walk = stampAnimal(still, "walk", i);
        const eat = stampAnimal(still, "eat", i);
        const idle = stampAnimal(still, "idle", i);
        frames.set(`animal_${kind}_walk_${i}`, walk);
        frames.set(`animal_${kind}_run_${i}`, walk);
        frames.set(`animal_${kind}_eat_${i}`, eat);
        frames.set(`animal_${kind}_sit_${i}`, idle);
        frames.set(`animal_${kind}_lay_${i}`, idle);
      }
    }),
  );

  const atlas = pack(frames);
  return { atlas, tileset };
}

export function cropFrame(atlas: Atlas, kind: CropKind, stage: 1 | 2 | 3 | 4): Texture {
  return atlas.frame(`crop_${kind}_${stage}`);
}
