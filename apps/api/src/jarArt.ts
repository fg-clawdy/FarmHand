import { buildJarArtPrompt, type SharedGoalArtStatus } from "@farmhand/shared";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * What to store after each art step.
 * Failure keeps a previous lid (READY + same URL). With no lid yet, stay on the pastel default.
 * `artUrl: "keep"` means do not touch the column.
 */
export function planJarArt(opts: {
  requested: boolean;
  previousUrl: string | null;
  phase: "create" | "success" | "failure";
}): { artStatus: SharedGoalArtStatus; artUrl: string | null | "keep" } {
  if (opts.phase === "create") {
    if (!opts.requested) return { artStatus: "DEFAULT", artUrl: null };
    return { artStatus: "QUEUED", artUrl: null };
  }
  if (opts.phase === "success") return { artStatus: "READY", artUrl: "set" };
  if (opts.previousUrl) return { artStatus: "READY", artUrl: "keep" };
  return { artStatus: "FAILED", artUrl: null };
}

export function jarArtDir(): string {
  if (process.env.JAR_ART_DIR?.trim()) return path.resolve(process.env.JAR_ART_DIR.trim());
  return path.resolve(here, "../../player/public/art/painted/jars");
}

export function jarArtPublicUrl(goalId: string): string {
  return `/api/media/jars/${goalId}.png`;
}

export function jarArtDiskPath(goalId: string): string {
  return path.join(jarArtDir(), `${goalId}.png`);
}

type PaintResult = { ok: true; png: Buffer } | { ok: false; reason: string };

/**
 * Venice `/image/generate`. Missing key is a soft miss — callers keep default art.
 * Default model is Flux 3 (`flux-3-image`), a resolution-tier model: it takes
 * `aspect_ratio` + `resolution`, not `width`/`height`. Pixel-based models
 * (e.g. `z-image-turbo`) keep the square 512 request.
 */
export async function paintJarLid(opts: {
  prompt: string;
  apiKey: string | undefined;
  fetcher?: typeof fetch;
}): Promise<PaintResult> {
  const key = opts.apiKey?.trim();
  if (!key) return { ok: false, reason: "no-key" };
  const fetcher = opts.fetcher ?? fetch;
  const model = process.env.VENICE_IMAGE_MODEL?.trim() || "flux-3-image";
  const resolutionTier = /^(flux-3|nano-banana|gpt-image)/.test(model);
  const sizing = resolutionTier
    ? { aspect_ratio: "1:1", resolution: "1K" }
    : { width: 512, height: 512 };
  let response: Response;
  try {
    response = await fetcher("https://api.venice.ai/api/v1/image/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt.slice(0, 1500),
        negative_prompt: "text, letters, words, watermark, neon, people, hands, scary, photorealistic",
        ...sizing,
        format: "png",
        safe_mode: true,
        variants: 1,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "venice-network" };
  }
  if (!response.ok) return { ok: false, reason: `venice-${response.status}` };
  let body: { images?: string[] };
  try {
    body = (await response.json()) as { images?: string[] };
  } catch {
    return { ok: false, reason: "venice-json" };
  }
  const raw = body.images?.[0];
  if (!raw) return { ok: false, reason: "venice-empty" };
  const png = Buffer.from(raw.replace(/^data:image\/\w+;base64,/, ""), "base64");
  if (png.length < 32) return { ok: false, reason: "venice-tiny" };
  return { ok: true, png };
}

const generation = new Map<string, number>();
let artVersion = 0;

/** Fire-and-forget. Never awaited by create or the playfield. */
export function enqueueJarArt(goalId: string) {
  const token = (generation.get(goalId) ?? 0) + 1;
  generation.set(goalId, token);
  void runJarArt(goalId, token);
}

/** Re-queue lids left QUEUED across a restart. */
export async function resumeQueuedJarArt() {
  const rows = await prisma.sharedGoal.findMany({
    where: { artStatus: "QUEUED" },
    select: { id: true },
  });
  for (const row of rows) enqueueJarArt(row.id);
}

async function runJarArt(goalId: string, token: number) {
  try {
    const goal = await prisma.sharedGoal.findUnique({ where: { id: goalId } });
    if (!goal || generation.get(goalId) !== token) return;
    const prompt =
      goal.artPrompt?.trim() ||
      buildJarArtPrompt({ title: goal.title, emoji: goal.emoji, notes: goal.artNotes });
    const painted = await paintJarLid({ prompt, apiKey: process.env.VENICE_API_KEY });
    if (generation.get(goalId) !== token) return;
    if (!painted.ok) {
      const plan = planJarArt({
        requested: true,
        previousUrl: goal.artUrl,
        phase: "failure",
      });
      await prisma.sharedGoal.update({
        where: { id: goalId },
        data: { artStatus: plan.artStatus },
      });
      if (painted.reason !== "no-key") {
        console.warn(`[jar-art] kept default for ${goalId}: ${painted.reason}`);
      }
      return;
    }
    await fs.mkdir(jarArtDir(), { recursive: true });
    await fs.writeFile(jarArtDiskPath(goalId), painted.png);
    if (generation.get(goalId) !== token) return;
    await prisma.sharedGoal.update({
      where: { id: goalId },
      data: {
        artStatus: "READY",
        artUrl: `${jarArtPublicUrl(goalId)}?v=${++artVersion}`,
      },
    });
  } catch (err) {
    if (generation.get(goalId) !== token) return;
    console.warn(`[jar-art] failed for ${goalId}`, err);
    try {
      const goal = await prisma.sharedGoal.findUnique({ where: { id: goalId } });
      if (!goal) return;
      const plan = planJarArt({ requested: true, previousUrl: goal.artUrl, phase: "failure" });
      await prisma.sharedGoal.update({
        where: { id: goalId },
        data: { artStatus: plan.artStatus },
      });
    } catch {
      /* the farm still has the pastel jar */
    }
  }
}
