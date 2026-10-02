import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JAR_TINTS,
  JAR_TRAY_CAPACITY,
  buildJarArtPrompt,
  compactJarTitle,
  jarProgressLabel,
  jarTint,
  tintIndexFor,
  trayWindow,
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
    assert.equal(jarProgressLabel(3, 10, "OPEN"), "30%");
    assert.equal(jarProgressLabel(9, 10, "OPEN"), "nearly full");
    assert.equal(jarProgressLabel(10, 10, "READY"), "Ready");
  });
});
