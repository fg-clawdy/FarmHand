import { Rectangle, Texture } from "pixi.js";
import { BIBLE, canvas, ellipseShadow, fitImage, loadImage, roundRect } from "./draw";

export type Atlas = {
  texture: Texture;
  frame: (name: string) => Texture;
  animation: (name: string) => Texture[];
};

const ANIMS = ["sit", "lay", "walk", "run", "eat"] as const;
export type AnimalAction = (typeof ANIMS)[number];
export const ANIMAL_KINDS = ["sheep", "duck", "cow", "chicken", "pig"] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];
export const CROP_KINDS = ["daisy", "herbs", "sunflower", "oak"] as const;
export type CropKind = (typeof CROP_KINDS)[number];

function poseSheet(src: HTMLCanvasElement, action: AnimalAction): HTMLCanvasElement[] {
  const frames = 6;
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < frames; i++) {
    const t = (i / frames) * Math.PI * 2;
    const [c, ctx] = canvas(src.width, src.height);
    const cx = src.width / 2;
    const cy = src.height * 0.62;
    ctx.translate(cx, cy);
    if (action === "walk") {
      ctx.translate(Math.sin(t) * 4, Math.abs(Math.sin(t)) * -5);
      ctx.scale(1 + Math.sin(t) * 0.03, 1 - Math.abs(Math.sin(t)) * 0.05);
    } else if (action === "run") {
      ctx.translate(Math.sin(t * 1.5) * 7, Math.abs(Math.sin(t * 1.5)) * -8);
      ctx.scale(1.06 + Math.sin(t) * 0.05, 0.94 - Math.abs(Math.sin(t)) * 0.06);
    } else if (action === "sit") {
      ctx.translate(0, 10 + Math.sin(t) * 1.5);
      ctx.scale(1.08, 0.72 + Math.sin(t) * 0.015);
    } else if (action === "lay") {
      ctx.rotate(-0.85 + Math.sin(t) * 0.03);
      ctx.translate(0, 16);
      ctx.scale(1.12, 0.55);
    } else {
      ctx.rotate(0.35 + Math.sin(t) * 0.08);
      ctx.translate(2, 8 + Math.sin(t) * 2);
      ctx.scale(1, 0.92);
    }
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    out.push(c);
  }
  return out;
}

function drawCow(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  ellipseShadow(ctx, size * 0.5, size * 0.86, size * 0.28, size * 0.08);
  ctx.fillStyle = "#f7f4ea";
  ctx.strokeStyle = BIBLE.outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.55, size * 0.28, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2a1a0d";
  ctx.beginPath();
  ctx.ellipse(size * 0.38, size * 0.48, size * 0.08, size * 0.07, 0, 0, Math.PI * 2);
  ctx.ellipse(size * 0.62, size * 0.6, size * 0.07, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4b4c8";
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.66, size * 0.12, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1a0d";
  ctx.beginPath();
  ctx.arc(size * 0.42, size * 0.48, 4, 0, Math.PI * 2);
  ctx.arc(size * 0.58, size * 0.48, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(size * 0.41, size * 0.47, 1.5, 0, Math.PI * 2);
  ctx.arc(size * 0.57, size * 0.47, 1.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function drawChicken(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  ellipseShadow(ctx, size * 0.5, size * 0.86, size * 0.22, size * 0.07);
  ctx.fillStyle = "#fff1c4";
  ctx.strokeStyle = BIBLE.outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.56, size * 0.22, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e23a2a";
  ctx.beginPath();
  ctx.moveTo(size * 0.42, size * 0.38);
  ctx.quadraticCurveTo(size * 0.5, size * 0.22, size * 0.58, size * 0.38);
  ctx.fill();
  ctx.fillStyle = "#f0a12a";
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.56);
  ctx.lineTo(size * 0.64, size * 0.6);
  ctx.lineTo(size * 0.5, size * 0.64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a1a0d";
  ctx.beginPath();
  ctx.arc(size * 0.46, size * 0.52, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(size * 0.45, size * 0.51, 1.2, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function drawPig(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  ellipseShadow(ctx, size * 0.5, size * 0.86, size * 0.26, size * 0.08);
  ctx.fillStyle = "#f7b4c4";
  ctx.strokeStyle = BIBLE.outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.56, size * 0.26, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e87898";
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.66, size * 0.12, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1a0d";
  ctx.beginPath();
  ctx.arc(size * 0.42, size * 0.5, 3.5, 0, Math.PI * 2);
  ctx.arc(size * 0.58, size * 0.5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(size * 0.41, size * 0.49, 1.2, 0, Math.PI * 2);
  ctx.arc(size * 0.57, size * 0.49, 1.2, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function drawSeed(): HTMLCanvasElement {
  const [c, ctx] = canvas(96, 96);
  ellipseShadow(ctx, 48, 78, 22, 8, 0.22);
  const g = ctx.createRadialGradient(40, 70, 4, 48, 76, 26);
  g.addColorStop(0, "#c4844a");
  g.addColorStop(1, "#3d2110");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(48, 76, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a85a22";
  ctx.strokeStyle = BIBLE.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(48, 62, 8, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  return c;
}

function drawGrown(kind: CropKind): HTMLCanvasElement {
  const [c, ctx] = canvas(128, 144);
  ellipseShadow(ctx, 64, 128, 28, 9, 0.22);
  const soil = ctx.createRadialGradient(56, 120, 6, 64, 126, 30);
  soil.addColorStop(0, "#c4844a");
  soil.addColorStop(1, "#3d2110");
  ctx.fillStyle = soil;
  ctx.beginPath();
  ctx.ellipse(64, 126, 30, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BIBLE.outline;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2f8a34";
  ctx.beginPath();
  ctx.moveTo(64, 126);
  ctx.quadraticCurveTo(60, 90, 64, 58);
  ctx.stroke();
  ctx.fillStyle = "#5fbe58";
  ctx.beginPath();
  ctx.ellipse(48, 88, 16, 9, -0.6, 0, Math.PI * 2);
  ctx.ellipse(80, 86, 16, 9, 0.6, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "oak") {
    ctx.fillStyle = "#3f8a3a";
    ctx.beginPath();
    ctx.arc(64, 62, 22, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "sunflower") {
    ctx.fillStyle = "#ffd24a";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(a) * 14, 56 + Math.sin(a) * 14, 6, 12, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#8a4f2a";
    ctx.beginPath();
    ctx.arc(64, 56, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "herbs") {
    ctx.strokeStyle = "#2f8a34";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(52, 126);
    ctx.lineTo(48, 70);
    ctx.moveTo(76, 126);
    ctx.lineTo(80, 68);
    ctx.stroke();
    ctx.fillStyle = "#7ed957";
    ctx.beginPath();
    ctx.ellipse(46, 74, 8, 5, -0.5, 0, Math.PI * 2);
    ctx.ellipse(82, 72, 8, 5, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#fffdf6";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(a) * 12, 54 + Math.sin(a) * 12, 5, 10, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffc84a";
    ctx.beginPath();
    ctx.arc(64, 54, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function drawTileset(): HTMLCanvasElement {
  const tile = 64;
  const cols = 4;
  const [c, ctx] = canvas(tile * cols, tile * cols);
  const paints: Array<(x: number, y: number) => void> = [
    (x, y) => grass(ctx, x, y, tile, BIBLE.grass),
    (x, y) => grass(ctx, x, y, tile, "#6dcc52"),
    (x, y) => grass(ctx, x, y, tile, BIBLE.grassDark),
    (x, y) => dirt(ctx, x, y, tile, false),
    (x, y) => dirt(ctx, x, y, tile, true),
    (x, y) => path(ctx, x, y, tile),
    (x, y) => water(ctx, x, y, tile),
    (x, y) => flower(ctx, x, y, tile),
    (x, y) => dirt(ctx, x, y, tile, true),
    (x, y) => grass(ctx, x, y, tile, "#4aa03a"),
    (x, y) => hay(ctx, x, y, tile),
    (x, y) => grass(ctx, x, y, tile, "#7ad45c"),
    (x, y) => dirt(ctx, x, y, tile, false),
    (x, y) => flower(ctx, x, y, tile),
    (x, y) => path(ctx, x, y, tile),
    (x, y) => grass(ctx, x, y, tile, BIBLE.grass),
  ];
  paints.forEach((fn, i) => fn((i % cols) * tile, Math.floor(i / cols) * tile));
  return c;
}

function grass(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, color);
  g.addColorStop(1, BIBLE.grassDark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "rgba(255,255,220,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 8 + i * 9, y + s - 6);
    ctx.quadraticCurveTo(x + 10 + i * 9, y + s - 22, x + 6 + i * 9, y + s - 28);
    ctx.stroke();
  }
}

function dirt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tilled: boolean) {
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, "#b87a44");
  g.addColorStop(1, BIBLE.soilDark);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  if (tilled) {
    ctx.strokeStyle = "rgba(40,20,10,0.35)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 12 + i * 14);
      ctx.lineTo(x + s - 4, y + 10 + i * 14);
      ctx.stroke();
    }
  }
}

function path(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#d2b48c";
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "#c4a574";
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 28, 8, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 44, y + 40, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function water(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, "#7ec8e3");
  g.addColorStop(1, "#2f7fa8");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(x + 24, y + 28, 10, 0.2, 2.2);
  ctx.stroke();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  grass(ctx, x, y, s, BIBLE.grass);
  ctx.fillStyle = "#ffe56a";
  ctx.beginPath();
  ctx.arc(x + 22, y + 28, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + 44, y + 38, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c46ad0";
  ctx.beginPath();
  ctx.arc(x + 32, y + 48, 4, 0, Math.PI * 2);
  ctx.fill();
}

function hay(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  grass(ctx, x, y, s, BIBLE.grass);
  ctx.fillStyle = "#e2b36a";
  roundRect(ctx, x + 16, y + 28, 32, 22, 6);
  ctx.fill();
}

function particleDot(): HTMLCanvasElement {
  const [c, ctx] = canvas(24, 24);
  const g = ctx.createRadialGradient(12, 12, 1, 12, 12, 12);
  g.addColorStop(0, "#fff");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 24, 24);
  return c;
}

function glowDot(): HTMLCanvasElement {
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

export async function buildAtlas(): Promise<{ atlas: Atlas; tileset: Texture }> {
  const frames = new Map<string, HTMLCanvasElement>();
  const tilesetCanvas = drawTileset();
  frames.set("tileset", tilesetCanvas);

  const png = async (name: string, src: string, size: number) => {
    try {
      const img = await loadImage(src);
      frames.set(name, fitImage(img, size));
    } catch {
      /* gap filled procedurally */
    }
  };

  await Promise.all([
    png("prop_barn", "/art/sprites/barn.png", 280),
    png("prop_store", "/art/sprites/store.png", 260),
    png("prop_sign", "/art/sprites/sign.png", 220),
    png("ui_can", "/art/sprites/can.png", 96),
    png("ui_beaker", "/art/sprites/beaker.png", 96),
    png("ui_acorn", "/art/sprites/acorn.png", 72),
    png("crop_daisy_4", "/art/sprites/daisy.png", 160),
    png("crop_sunflower_4", "/art/sprites/sunflower.png", 160),
    png("crop_oak_4", "/art/sprites/oak.png", 160),
    png("crop_sprout", "/art/sprites/sprout.png", 120),
    png("animal_sheep_still", "/art/sprites/sheep.png", 140),
    png("animal_duck_still", "/art/sprites/duck.png", 120),
  ]);

  frames.set("animal_cow_still", drawCow(140));
  frames.set("animal_chicken_still", drawChicken(120));
  frames.set("animal_pig_still", drawPig(130));
  frames.set("crop_seed", drawSeed());
  for (const kind of CROP_KINDS) {
    frames.set(`crop_${kind}_1`, frames.get("crop_seed")!);
    frames.set(`crop_${kind}_2`, frames.get("crop_sprout") ?? drawGrown(kind));
    frames.set(`crop_${kind}_3`, drawGrown(kind));
    if (!frames.has(`crop_${kind}_4`)) frames.set(`crop_${kind}_4`, drawGrown(kind));
  }
  frames.set("fx_dot", particleDot());
  frames.set("fx_glow", glowDot());

  for (const kind of ANIMAL_KINDS) {
    const still = frames.get(`animal_${kind}_still`);
    if (!still) continue;
    for (const action of ANIMS) {
      poseSheet(still, action).forEach((frame, i) => frames.set(`animal_${kind}_${action}_${i}`, frame));
    }
  }

  const atlas = pack(frames);
  return { atlas, tileset: atlas.frame("tileset") };
}

export function cropFrame(atlas: Atlas, kind: CropKind, stage: 1 | 2 | 3 | 4): Texture {
  return atlas.frame(`crop_${kind}_${stage}`);
}
