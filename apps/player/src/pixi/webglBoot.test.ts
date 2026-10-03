import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  GARDEN_CLEAR_HEX,
  GARDEN_CLEAR_RGB,
  MIN_HOST_PX,
  canvasPoolCss,
  frameLooksBlank,
  gardenPresentStatus,
  nearClear,
  patchPixiWebGL1AttribSource,
  rendererInitOptions,
  sampleRgbaGrid,
  type Rgba,
} from "./webglBoot.ts";

const pixiAttribUrl = new URL(
  "../../../../node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/extractAttributesFromGlProgram.mjs",
  import.meta.url,
);

test("renderer prefers WebGL2 and the grass clear color", () => {
  const options = rendererInitOptions(3, { width: 1280, height: 800 });
  assert.equal(options.preferWebGLVersion, 2);
  assert.equal(options.preference, "webgl");
  assert.equal(options.background, GARDEN_CLEAR_HEX);
  assert.equal(options.backgroundAlpha, 1);
  assert.equal(options.powerPreference, "low-power");
  assert.equal(options.resolution, 2);
  assert.equal(options.width, 1280);
  assert.equal(options.height, 800);
});

test("canvas pool stays in the document without an opacity:0 compositor kill", () => {
  const css = canvasPoolCss();
  assert.equal(css.includes("opacity"), false);
  assert.match(css, /position:fixed/);
  assert.match(css, /left:-10000px/);
});

test("WebGL1 attribute patch disables bindAttribLocation and is idempotent", () => {
  const src = fs.readFileSync(fileURLToPath(pixiAttribUrl), "utf8");
  assert.match(src, /if \(sortAttributes\)/);
  assert.match(src, /bindAttribLocation/);
  const patched = patchPixiWebGL1AttribSource(src);
  assert.match(patched, /if \(false && sortAttributes\)/);
  assert.equal(patched.includes("if (sortAttributes)"), false);
  assert.match(patched, /getAttribLocation/);
  assert.equal(patchPixiWebGL1AttribSource(patched), patched);
});

test("a uniform grass-clear grid is the blank tablet failure", () => {
  const clear: Rgba = { ...GARDEN_CLEAR_RGB, a: 255 };
  const samples = Array.from({ length: 9 }, () => ({ ...clear }));
  assert.equal(frameLooksBlank(samples), true);
  assert.deepEqual(
    gardenPresentStatus({
      stageChildren: 1,
      screenW: 1280,
      screenH: 800,
      contextLost: false,
      webGLVersion: 1,
      samples,
    }),
    { ok: false, reason: "webgl1-clear-only" },
  );
  assert.deepEqual(
    gardenPresentStatus({
      stageChildren: 1,
      screenW: 1280,
      screenH: 800,
      contextLost: false,
      webGLVersion: 2,
      samples,
    }),
    { ok: false, reason: "clear-color-only" },
  );
});

test("soil and fence samples count as a drawn garden, not the green backdrop", () => {
  // Measured off garden_zoom_3x3.jpg — none of these sit near #3d8a32.
  const painting: Rgba[] = [
    { r: 139, g: 154, b: 3, a: 255 },
    { r: 107, g: 42, b: 0, a: 255 },
    { r: 168, g: 98, b: 26, a: 255 },
    { r: 85, g: 51, b: 24, a: 255 },
    { r: 157, g: 112, b: 73, a: 255 },
    { r: 149, g: 89, b: 37, a: 255 },
    { r: 63, g: 44, b: 4, a: 255 },
    { r: 234, g: 177, b: 100, a: 255 },
    { r: 142, g: 81, b: 18, a: 255 },
  ];
  assert.equal(painting.some((pixel) => nearClear(pixel)), false);
  assert.equal(frameLooksBlank(painting), false);
  assert.deepEqual(
    gardenPresentStatus({
      stageChildren: 1,
      screenW: 1280,
      screenH: 800,
      contextLost: false,
      webGLVersion: 2,
      samples: painting,
    }),
    { ok: true, reason: "scene-drawn" },
  );
});

test("context loss, an empty stage, and a tiny canvas are distinct failures", () => {
  const drawn: Rgba[] = [
    { r: 168, g: 98, b: 26, a: 255 },
    { r: 85, g: 51, b: 24, a: 255 },
    { r: 149, g: 89, b: 37, a: 255 },
    { r: 63, g: 44, b: 4, a: 255 },
    { r: 234, g: 177, b: 100, a: 255 },
    { r: 142, g: 81, b: 18, a: 255 },
  ];
  assert.equal(
    gardenPresentStatus({
      stageChildren: 1,
      screenW: 1280,
      screenH: 800,
      contextLost: true,
      webGLVersion: 2,
      samples: drawn,
    }).reason,
    "webgl-context-lost",
  );
  assert.equal(
    gardenPresentStatus({
      stageChildren: 0,
      screenW: 1280,
      screenH: 800,
      contextLost: false,
      webGLVersion: 2,
      samples: drawn,
    }).reason,
    "empty-stage",
  );
  assert.equal(
    gardenPresentStatus({
      stageChildren: 1,
      screenW: 2,
      screenH: 2,
      contextLost: false,
      webGLVersion: 2,
      samples: drawn,
    }).reason,
    "zero-size-canvas",
  );
  assert.equal(MIN_HOST_PX > 2, true);
});

test("sampleRgbaGrid reads the middle of an RGBA buffer", () => {
  const width = 10;
  const height = 10;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const x = 5;
  const y = 5;
  const i = (y * width + x) * 4;
  pixels[i] = 168;
  pixels[i + 1] = 98;
  pixels[i + 2] = 26;
  pixels[i + 3] = 255;
  const samples = sampleRgbaGrid(pixels, width, height, [0.5]);
  assert.deepEqual(samples, [{ r: 168, g: 98, b: 26, a: 255 }]);
});
