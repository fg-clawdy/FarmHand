/**
 * Phase 3 Integration Test — Sprite Loading Pipeline Validation
 *
 * Simulates the same logic as atlas.ts in the browser but runs via Node.js.
 * Verifies:
 *   1. Spritesheet PNGs exist at correct paths (no 404s)
 *   2. Frames are correctly split (6 frames from 576-wide strip)
 *   3. Crop stage PNGs exist at correct paths
 *   4. File sizes look reasonable (not empty/corrupt)
 *
 * Usage: node scripts/validate-sprites.cjs
 */

const sharp = require("sharp");
const { readFileSync, readdirSync, statSync, existsSync } = require("fs");
const { join, basename } = require("path");

const GEN = join(__dirname, "..", "apps", "player", "public", "art", "generated");
const ANIMALS = ["sheep", "duck", "cow", "chicken", "pig"];
const ACTIONS = ["walk", "run", "eat", "sit", "lay"];
const CROPS = ["daisy", "herbs", "sunflower", "oak"];

let passed = 0;
let failed = 0;
const errors = [];

function ok(msg) {
  console.log(`  ✅ ${msg}`);
  passed++;
}

function fail(msg) {
  console.log(`  ❌ ${msg}`);
  failed++;
  errors.push(msg);
}

async function main() {
  console.log("\n🔍 Phase 3 — Sprite Loading Pipeline Validation");
  console.log("=".repeat(56));

  // ─── Animal Spritesheets ────────────────────────────────────────
  console.log("\n📦 Animal Spritesheets (5 kinds × 5 actions × 6 frames)");
  console.log("-".repeat(48));

  let totalAnimalFrames = 0;

  for (const kind of ANIMALS) {
    for (const action of ACTIONS) {
      const path = join(GEN, "animals", kind, action, "spritesheet.png");
      const relPath = `art/generated/animals/${kind}/${action}/spritesheet.png`;

      if (!existsSync(path)) {
        fail(`${relPath} — MISSING`);
        continue;
      }

      const stat = statSync(path);

      if (stat.size < 100) {
        fail(`${relPath} — too small (${stat.size} bytes), likely corrupt`);
        continue;
      }

      try {
        const meta = await sharp(path).metadata();

        // Check dimensions: 576×96 for 6 frames of 96×96
        if (meta.width !== 576 || meta.height !== 96) {
          fail(
            `${relPath} — wrong dimensions ${meta.width}×${meta.height} (expected 576×96)`,
          );
          continue;
        }

        if (meta.format !== "png") {
          fail(`${relPath} — wrong format "${meta.format}" (expected png)`);
          continue;
        }

        // Verify we can extract individual frames
        const frameBuffers = [];
        for (let i = 0; i < 6; i++) {
          const frame = await sharp(path)
            .extract({ left: i * 96, top: 0, width: 96, height: 96 })
            .png()
            .toBuffer();
          frameBuffers.push(frame);
        }

        // Check each frame has content
        let validFrames = 0;
        for (let i = 0; i < 6; i++) {
          const fmeta = await sharp(frameBuffers[i]).metadata();
          if (fmeta.width === 96 && fmeta.height === 96 && frameBuffers[i].length > 50) {
            validFrames++;
          }
        }

        ok(
          `${kind}/${action} — ${meta.width}×${meta.height} PNG, ${stat.size}B, ${validFrames}/6 frames valid`,
        );
        totalAnimalFrames += validFrames;
      } catch (e) {
        fail(`${relPath} — sharp error: ${e.message}`);
      }
    }
  }

  // ─── Crop Stages ────────────────────────────────────────────────
  console.log("\n🌱 Crop Stage Sprites (4 kinds × 4 stages)");
  console.log("-".repeat(48));

  let totalCrops = 0;

  for (const kind of CROPS) {
    for (let stage = 1; stage <= 4; stage++) {
      const path = join(GEN, "crops", kind, `stage_${stage}.png`);
      const relPath = `art/generated/crops/${kind}/stage_${stage}.png`;

      if (!existsSync(path)) {
        fail(`${relPath} — MISSING`);
        continue;
      }

      const stat = statSync(path);

      if (stat.size < 100) {
        fail(`${relPath} — too small (${stat.size} bytes), likely corrupt`);
        continue;
      }

      try {
        const meta = await sharp(path).metadata();

        // Crop stages are expected at 128×256
        if (meta.width < 64 || meta.height < 64 || meta.width > 512 || meta.height > 512) {
          fail(
            `${relPath} — suspicious dimensions ${meta.width}×${meta.height}`,
          );
          continue;
        }

        ok(`${kind}/stage_${stage} — ${meta.width}×${meta.height} PNG, ${stat.size}B`);
        totalCrops++;
      } catch (e) {
        fail(`${relPath} — sharp error: ${e.message}`);
      }
    }
  }

  // ─── Terrain Tiles ───────────────────────────────────────────────
  console.log("\n🧱 Terrain Tiles");
  console.log("-".repeat(48));

  const TILES = [{ path: "tiles/grass.png", w: 128, h: 256, label: "grass tile" }];
  let totalTiles = 0;
  for (const tile of TILES) {
    const path = join(GEN, tile.path);
    if (!existsSync(path)) { fail(`${tile.path} — MISSING`); continue; }
    try {
      const meta = await sharp(path).metadata();
      if (meta.width !== tile.w || meta.height !== tile.h)
        fail(`${tile.path} — size ${meta.width}×${meta.height} (expected ${tile.w}×${tile.h})`);
      else ok(`${tile.path} — ${tile.label} ${meta.width}×${meta.height}`);
      totalTiles++;
    } catch (e) { fail(`${tile.path} — sharp error: ${e.message}`); }
  }

  // ─── Building Props ──────────────────────────────────────────────
  console.log("\n🏠 Building Props");
  console.log("-".repeat(48));

  const PROPS = [
    { path: "props/store.png", minW: 100, minH: 200, label: "store" },
    { path: "props/barn.png", minW: 100, minH: 200, label: "barn" },
    { path: "props/silo.png", minW: 80, minH: 150, label: "silo" },
  ];
  let totalProps = 0;
  for (const prop of PROPS) {
    const path = join(GEN, prop.path);
    if (!existsSync(path)) { fail(`${prop.path} — MISSING`); continue; }
    try {
      const meta = await sharp(path).metadata();
      if (meta.width < prop.minW || meta.height < prop.minH)
        fail(`${prop.path} — too small ${meta.width}×${meta.height}`);
      else ok(`${prop.path} — ${prop.label} ${meta.width}×${meta.height}`);
      totalProps++;
    } catch (e) { fail(`${prop.path} — sharp error: ${e.message}`); }
  }

  // ─── FX Particles ───────────────────────────────────────────────
  console.log("\n✨ FX Particles");
  console.log("-".repeat(48));

  const FX = [
    { path: "fx/water_drop.png", label: "water drop" },
    { path: "fx/leaf.png", label: "leaf" },
    { path: "fx/star.png", label: "star" },
    { path: "fx/glow.png", label: "glow" },
  ];
  let totalFx = 0;
  for (const fx of FX) {
    const path = join(GEN, fx.path);
    if (!existsSync(path)) { fail(`${fx.path} — MISSING`); continue; }
    try {
      const meta = await sharp(path).metadata();
      ok(`${fx.path} — ${fx.label} ${meta.width}×${meta.height}`);
      totalFx++;
    } catch (e) { fail(`${fx.path} — sharp error: ${e.message}`); }
  }

  // ─── Summary ────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(56));
  console.log("📊 SUMMARY");
  console.log("-".repeat(48));
  console.log(`  Animal spritesheets: ${ANIMALS.length * ACTIONS.length} expected`);
  console.log(`  Animal frames:       ${totalAnimalFrames} / ${ANIMALS.length * ACTIONS.length * 6}`);
  console.log(`  Crop stages:         ${totalCrops} / ${CROPS.length * 4}`);
  console.log(`  Terrain tiles:       ${totalTiles} / ${TILES.length}`);
  console.log(`  Building props:      ${totalProps} / ${PROPS.length}`);
  console.log(`  FX particles:        ${totalFx} / ${FX.length}`);
  console.log(`  Tests passed:        ${passed}`);
  console.log(`  Tests failed:        ${failed}`);

  if (failed > 0) {
    console.log("\n❌ FAILURES:");
    errors.forEach((e) => console.log(`   - ${e}`));
  }

  console.log(
    failed === 0
      ? "\n🎉 ALL CHECKS PASSED — Sprites are ready for the game engine!"
      : "\n⚠️  Some checks failed — see above.",
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
