import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const smokeSrc = readFileSync(join(here, "smoke.mjs"), "utf8");

describe("smoke config restore hardening", () => {
  it("defines restoreDefaultConfig that POSTs /api/admin/config/reset", () => {
    assert.match(smokeSrc, /async function restoreDefaultConfig\s*\(/);
    assert.match(smokeSrc, /\/api\/admin\/config\/reset/);
  });

  it("wraps mutable smoke body in try/finally that always restores", () => {
    assert.match(
      smokeSrc,
      /try\s*\{\s*\nawait restoreDefaultConfig\(adminCookie,\s*"smoke start reset"\)/,
    );
    assert.match(
      smokeSrc,
      /\}\s*finally\s*\{[\s\S]*restoreDefaultConfig\(adminCookie,\s*"config after smoke"\)/,
    );
  });

  it("rejects leftover TEST sub-hour durations after restore", () => {
    assert.match(smokeSrc, /MIN_PRODUCTION_DURATION_MINUTES\s*=\s*60/);
    assert.match(smokeSrc, /still has TEST durationMinutes/);
  });

  it("hardens ensureEmptySlots temporary duration=0 with try/finally", () => {
    const idx = smokeSrc.indexOf("async function ensureEmptySlots");
    assert.ok(idx >= 0, "ensureEmptySlots missing");
    const chunk = smokeSrc.slice(idx, idx + 1200);
    assert.match(chunk, /durationMinutes:\s*0/);
    assert.match(chunk, /try\s*\{/);
    assert.match(chunk, /\}\s*finally\s*\{/);
  });
});
