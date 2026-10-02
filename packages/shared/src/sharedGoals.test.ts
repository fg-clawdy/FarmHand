import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JAR_TINTS,
  JAR_TRAY_CAPACITY,
  buildJarArtPrompt,
  compactJarTitle,
  giftGhostBand,
  jarProgressLabel,
  jarTint,
  pourPreview,
  tintIndexFor,
  trayWindow,
  tubeFillRatio,
} from "./sharedGoals.js";

describe("shared goal jar art", () => {
  it("uses a small soft palette", () => {
    assert.deepEqual(
      JAR_TINTS.map((tint) => tint.id),
      ["sage", "clay", "cornflower", "butter", "lilac"],
    );
    for (const tint of JAR_TINTS) {
      assert.match(tint.glass, /^#[0-9a-f]{6}$/);
      assert.notEqual(tint.glass.toLowerCase(), "#00ff00");
    }
  });

  it("keeps a title on the same tint", () => {
    assert.equal(tintIndexFor("Movie night", 2), tintIndexFor("Movie night", 2));
    assert.ok(tintIndexFor("Movie night") < JAR_TINTS.length);
    assert.equal(jarTint(99).id, JAR_TINTS[99 % JAR_TINTS.length]?.id);
    assert.equal(jarTint(-1).id, JAR_TINTS.at(-1)?.id);
  });

  it("builds a prompt from the title without waiting on a model", () => {
    const prompt = buildJarArtPrompt({
      title: "Read together",
      emoji: "📚",
      notes: "warm lamp, soft greens",
    });
    assert.match(prompt, /Read together/);
    assert.match(prompt, /warm lamp/);
    assert.match(prompt, /no neon/);
    assert.match(prompt, /badge/i);
    assert.doesNotMatch(prompt, /mason jar/i);
    assert.ok(prompt.length <= 1500);
  });

  it("fits about three jars and reports overflow", () => {
    const jars = ["a", "b", "c", "d", "e"];
    const windowed = trayWindow(jars, JAR_TRAY_CAPACITY);
    assert.deepEqual(windowed.shown, ["a", "b", "c"]);
    assert.deepEqual(windowed.hidden, ["d", "e"]);
    assert.equal(windowed.overflow, 2);
    assert.equal(trayWindow([]).overflow, 0);
  });

  it("uses compact kid labels and no donor language", () => {
    assert.equal(compactJarTitle("Family ice cream", 12), "Family ice…");
    assert.equal(compactJarTitle("Movie"), "Movie");
    assert.equal(jarProgressLabel(3, 10, "OPEN"), "3/10");
    assert.equal(jarProgressLabel(9, 10, "OPEN"), "9/10");
    assert.equal(jarProgressLabel(10, 10, "READY"), "10/10");
    assert.equal(jarProgressLabel(12, 10, "OPEN"), "10/10");
    assert.equal(tubeFillRatio(3, 10), 0.3);
    assert.equal(tubeFillRatio(12, 10), 1);
    const preview = pourPreview(3, 10, 5);
    assert.equal(preview.label, "3/10 → 8/10");
    assert.equal(pourPreview(9, 10, 5).toFilled, 10);
    const band = giftGhostBand(0.3, 0.8);
    assert.equal(band.bottom, 0.3);
    assert.equal(band.height, 0.5);
    assert.equal(band.solid, 0.8);
    assert.equal(giftGhostBand(0.3, 1.4).solid, 1);
  });
});
