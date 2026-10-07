/**
 * Tablet boot contract for the shared Pixi renderer.
 *
 * The grass clear color is #3d8a32 — the same green as the page background.
 * A garden that "loads" but only clears that color looks like an empty green
 * div: HUD (profile, points, seeds, tools) is DOM, so it keeps working.
 *
 * PixiJS 8 on WebGL1 sorts attribute names, calls bindAttribLocation, and
 * links the program a second time. On Adreno/ANGLE (typical kid-tablet GPUs,
 * and any device we force onto WebGL1) that second link draws zero fragments
 * and raises no GL error — only the clear color. WebGL2 shaders are
 * `#version 300 es` and read driver locations with getAttribLocation, which
 * draws. See https://github.com/pixijs/pixijs/issues/12086
 */

export const GARDEN_CLEAR_HEX = 0x3d8a32;

/** Page / renderer clear. A presented frame of only this color is not a garden. */
export const GARDEN_CLEAR_RGB = { r: 0x3d, g: 0x8a, b: 0x32 } as const;

/**
 * CSS gives .pixi-host min-width/min-height 2px so it cannot collapse to 0.
 * That 2px box must not count as "laid out" or we resize the shared canvas to
 * a couple of pixels and CSS stretches the clear color over the tablet.
 */
export const MIN_HOST_PX = 32;

export type Rgba = { r: number; g: number; b: number; a: number };

export function rendererInitOptions(
  devicePixelRatio: number,
  view: { width: number; height: number } = { width: 800, height: 600 },
) {
  return {
    background: GARDEN_CLEAR_HEX,
    backgroundAlpha: 1,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(devicePixelRatio || 1, 2),
    // low-power: mobile Firefox PWAs drew clear-color-only with high-performance.
    // Do NOT pair this with preferWebGLVersion 1 — that is the Adreno blank path.
    powerPreference: "low-power" as const,
    preference: "webgl" as const,
    preferWebGLVersion: 2 as const,
    width: view.width,
    height: view.height,
  };
}

/**
 * Park the shared canvas in the document (detaching it loses the WebGL context
 * on some tablets) without opacity:0. Chrome Android drops the composited
 * WebGL layer after a canvas has lived under an opacity:0 ancestor, which
 * again shows only the page's grass green.
 */
export function canvasPoolCss(): string {
  return "position:fixed;left:-10000px;top:0;width:8px;height:8px;overflow:hidden;pointer-events:none;z-index:-1;";
}

/**
 * Force Pixi's WebGL1 attribute extract onto the driver-location path.
 * `if (sortAttributes)` becomes `if (false && sortAttributes)`, so the
 * bindAttribLocation + relink branch is dead and the existing else branch
 * (getAttribLocation) runs. Idempotent.
 */
export function patchPixiWebGL1AttribSource(code: string): string {
  if (code.includes("if (false && sortAttributes)")) return code;
  if (!code.includes("bindAttribLocation") || !code.includes("if (sortAttributes)")) return code;
  return code.replaceAll("if (sortAttributes)", "if (false && sortAttributes)");
}

export function nearClear(pixel: Rgba, tolerance = 8): boolean {
  return (
    Math.abs(pixel.r - GARDEN_CLEAR_RGB.r) <= tolerance &&
    Math.abs(pixel.g - GARDEN_CLEAR_RGB.g) <= tolerance &&
    Math.abs(pixel.b - GARDEN_CLEAR_RGB.b) <= tolerance &&
    pixel.a >= 250
  );
}

/** Nine samples in the middle of a frame. Letterbox bars stay outside this box. */
export function sampleRgbaGrid(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  fractions: readonly number[] = [0.35, 0.5, 0.65],
): Rgba[] {
  if (width < 1 || height < 1) return [];
  const out: Rgba[] = [];
  for (const fy of fractions) {
    for (const fx of fractions) {
      const x = Math.min(width - 1, Math.max(0, Math.floor(fx * width)));
      const y = Math.min(height - 1, Math.max(0, Math.floor(fy * height)));
      const i = (y * width + x) * 4;
      out.push({
        r: pixels[i] ?? 0,
        g: pixels[i + 1] ?? 0,
        b: pixels[i + 2] ?? 0,
        a: pixels[i + 3] ?? 0,
      });
    }
  }
  return out;
}

/**
 * True when every sample is the grass clear color.
 * garden_zoom_3x3.jpg has no pixel within ±8 of #3d8a32, so a drawn playfield
 * cannot pass this check. An empty stage / broken WebGL1 program can.
 */
export function frameLooksBlank(samples: readonly Rgba[], tolerance = 8): boolean {
  if (samples.length < 6) return false;
  return samples.every((pixel) => nearClear(pixel, tolerance));
}

export type PresentInput = {
  stageChildren: number;
  screenW: number;
  screenH: number;
  contextLost: boolean;
  webGLVersion: number;
  samples: readonly Rgba[] | null;
};

export type PresentStatus = { ok: boolean; reason: string };

/** Why the playfield is or isn't actually on screen. Reasons are stable for tests. */
export function gardenPresentStatus(input: PresentInput): PresentStatus {
  if (input.contextLost) return { ok: false, reason: "webgl-context-lost" };
  if (input.screenW < MIN_HOST_PX || input.screenH < MIN_HOST_PX) {
    return { ok: false, reason: "zero-size-canvas" };
  }
  if (input.stageChildren < 1) return { ok: false, reason: "empty-stage" };
  if (!input.samples || input.samples.length < 6) return { ok: false, reason: "no-pixels" };
  if (frameLooksBlank(input.samples)) {
    return {
      ok: false,
      reason: input.webGLVersion === 1 ? "webgl1-clear-only" : "clear-color-only",
    };
  }
  return { ok: true, reason: "scene-drawn" };
}
