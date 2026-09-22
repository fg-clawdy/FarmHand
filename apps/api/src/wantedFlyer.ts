import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TW = 516;
const TH = 772;
const ICON_BOX = { l: 0.2, t: 0.44, r: 0.8, b: 0.66 };
const TITLE_BOX = { l: 0.1, t: 0.68, r: 0.9, b: 0.84 };
const REWARD_BOX = { l: 0.15, t: 0.86, r: 0.85, b: 0.95 };

const here = path.dirname(fileURLToPath(import.meta.url));

function region(box: { l: number; t: number; r: number; b: number }) {
  return {
    x: Math.round(box.l * TW),
    y: Math.round(box.t * TH),
    w: Math.round((box.r - box.l) * TW),
    h: Math.round((box.b - box.t) * TH),
  };
}

/** Writable directory for generated flyer PNGs. */
export function wantedFlyerDir(): string {
  if (process.env.WANTED_FLYER_DIR?.trim()) return path.resolve(process.env.WANTED_FLYER_DIR.trim());
  // Monorepo dev default: player public art folder
  return path.resolve(here, "../../player/public/art/painted/farm/wanted/chores");
}

export function wantedFlyerPublicUrl(slug: string): string {
  return `/api/media/wanted/${slug}.png`;
}

export function wantedFlyerDiskPath(slug: string): string {
  return path.join(wantedFlyerDir(), `${slug}.png`);
}

async function resolveTemplatePath(): Promise<string> {
  if (process.env.WANTED_TEMPLATE_PATH?.trim()) {
    return path.resolve(process.env.WANTED_TEMPLATE_PATH.trim());
  }
  const candidates = [
    path.resolve(here, "../../player/public/art/painted/farm/wanted/wanted_poster_template.png"),
    path.resolve(here, "../assets/wanted_poster_template.png"),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `Wanted poster template missing. Tried:\n${candidates.join("\n")}`,
  );
}

function fontPath(): string {
  return path.resolve(here, "../assets/fonts/AlfaSlabOne-Regular.ttf");
}

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  try {
    GlobalFonts.registerFromPath(fontPath(), "WantedSlab");
    fontsReady = true;
  } catch {
    // Fall back to built-in fonts if register fails
    fontsReady = true;
  }
}

function fitFontSize(text: string, maxW: number, maxH: number, start: number, min = 12): number {
  let size = start;
  const canvas = createCanvas(1, 1);
  const ctx = canvas.getContext("2d");
  while (size >= min) {
    ctx.font = `bold ${size}px WantedSlab, serif`;
    const m = ctx.measureText(text);
    const h = size * 1.15;
    if (m.width <= maxW && h <= maxH) return size;
    size -= 2;
  }
  return min;
}

function wrapLines(ctx: { font: string; measureText: (t: string) => { width: number } }, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = (cur ? `${cur} ${w}` : w).trim();
    if (ctx.measureText(trial).width <= maxW) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

export type WantedFlyerInput = {
  slug: string;
  title: string;
  emoji: string;
  rewardLabel?: string;
};

/**
 * Compose a Wanted flyer onto the blank template and write chores/{slug}.png.
 * Pure local canvas — no LLM / external image APIs.
 */
export async function generateWantedFlyer(input: WantedFlyerInput): Promise<{ path: string; url: string }> {
  ensureFonts();
  const slug = input.slug.trim();
  if (!slug) throw new Error("Wanted flyer needs a slug.");
  const title = (input.title || "Chore").trim().toUpperCase();
  const emoji = (input.emoji || "⭐").trim();
  const reward = (input.rewardLabel || "+1 SEED").trim().toUpperCase();

  const tplFile = await resolveTemplatePath();
  const outDir = wantedFlyerDir();
  await fs.mkdir(outDir, { recursive: true });

  const tpl = await loadImage(tplFile);
  const canvas = createCanvas(TW, TH);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, TW, TH);
  // Cover-fit template into canvas
  const scale = Math.min(TW / tpl.width, TH / tpl.height);
  const nw = tpl.width * scale;
  const nh = tpl.height * scale;
  ctx.drawImage(tpl, (TW - nw) / 2, (TH - nh) / 2, nw, nh);

  // Icon (emoji as aged ink)
  const icon = region(ICON_BOX);
  const iconSize = Math.min(icon.w, icon.h) - 4;
  ctx.save();
  ctx.font = `${Math.floor(iconSize * 0.72)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(40, 22, 8, 0.92)";
  ctx.fillText(emoji, icon.x + icon.w / 2, icon.y + icon.h / 2);
  ctx.restore();

  // Title
  const titleBox = region(TITLE_BOX);
  let titleSize = fitFontSize(title, titleBox.w, titleBox.h / 2 + 8, 40);
  ctx.font = `bold ${titleSize}px WantedSlab, serif`;
  let lines = wrapLines(ctx, title, titleBox.w);
  while (lines.length > 3 && titleSize > 14) {
    titleSize -= 2;
    ctx.font = `bold ${titleSize}px WantedSlab, serif`;
    lines = wrapLines(ctx, title, titleBox.w);
  }
  const lineH = titleSize * 1.15;
  let y = titleBox.y + Math.max(0, (titleBox.h - lines.length * lineH) / 2) + titleSize;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const line of lines) {
    ctx.fillStyle = "rgba(95, 62, 28, 0.4)";
    ctx.fillText(line, titleBox.x + titleBox.w / 2 + 1, y + 1);
    ctx.fillStyle = "rgba(40, 22, 8, 0.92)";
    ctx.fillText(line, titleBox.x + titleBox.w / 2, y);
    y += lineH;
  }

  // Reward
  const rewardBox = region(REWARD_BOX);
  const rewardSize = fitFontSize(reward, rewardBox.w, rewardBox.h, 26);
  ctx.font = `bold ${rewardSize}px WantedSlab, serif`;
  const ry = rewardBox.y + rewardBox.h / 2 + rewardSize / 3;
  ctx.fillStyle = "rgba(95, 62, 28, 0.35)";
  ctx.fillText(reward, rewardBox.x + rewardBox.w / 2 + 1, ry + 1);
  ctx.fillStyle = "rgba(50, 28, 10, 0.9)";
  ctx.fillText(reward, rewardBox.x + rewardBox.w / 2, ry);

  const outPath = wantedFlyerDiskPath(slug);
  const buf = canvas.toBuffer("image/png");
  await fs.writeFile(outPath, buf);
  return { path: outPath, url: wantedFlyerPublicUrl(slug) };
}

export async function ensureWantedFlyer(input: WantedFlyerInput): Promise<{ path: string; url: string }> {
  const disk = wantedFlyerDiskPath(input.slug);
  try {
    const st = await fs.stat(disk);
    if (st.isFile() && st.size > 0) return { path: disk, url: wantedFlyerPublicUrl(input.slug) };
  } catch {
    // missing — generate
  }
  return generateWantedFlyer(input);
}

export async function deleteWantedFlyer(slug: string): Promise<void> {
  try {
    await fs.unlink(wantedFlyerDiskPath(slug));
  } catch {
    // ignore missing
  }
}
