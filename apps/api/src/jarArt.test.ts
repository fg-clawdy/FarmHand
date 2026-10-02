import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paintJarLid, planJarArt } from "./jarArt.js";

describe("jar art plan", () => {
  it("assigns default art immediately when AI is off", () => {
    assert.deepEqual(planJarArt({ requested: false, previousUrl: null, phase: "create" }), {
      artStatus: "DEFAULT",
      artUrl: null,
    });
  });

  it("queues without a URL so create can return before Venice", () => {
    assert.deepEqual(planJarArt({ requested: true, previousUrl: null, phase: "create" }), {
      artStatus: "QUEUED",
      artUrl: null,
    });
  });

  it("keeps the pastel jar when the first paint fails", () => {
    assert.deepEqual(planJarArt({ requested: true, previousUrl: null, phase: "failure" }), {
      artStatus: "FAILED",
      artUrl: null,
    });
  });

  it("keeps the previous lid when a regenerate fails", () => {
    assert.deepEqual(planJarArt({ requested: true, previousUrl: "/api/media/jars/a.png", phase: "failure" }), {
      artStatus: "READY",
      artUrl: "keep",
    });
  });
});

describe("paintJarLid", () => {
  it("does not call Venice when the key is missing", async () => {
    let called = false;
    const result = await paintJarLid({
      prompt: "a cork",
      apiKey: "  ",
      fetcher: async () => {
        called = true;
        return new Response("nope");
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "no-key");
    assert.equal(called, false);
  });

  it("decodes a Venice JSON image", async () => {
    const png = Buffer.from("fake-png-bytes-that-are-long-enough-for-the-check");
    const result = await paintJarLid({
      prompt: "sage jar",
      apiKey: "test-key",
      fetcher: async (input, init) => {
        assert.match(String(input), /\/image\/generate$/);
        const body = JSON.parse(String(init?.body)) as { safe_mode: boolean; width: number };
        assert.equal(body.safe_mode, true);
        assert.equal(body.width, 512);
        return new Response(JSON.stringify({ images: [png.toString("base64")] }), { status: 200 });
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.png.toString(), png.toString());
  });

  it("returns a soft failure on a Venice error status", async () => {
    const result = await paintJarLid({
      prompt: "jar",
      apiKey: "test-key",
      fetcher: async () => new Response("no", { status: 503 }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "venice-503");
  });
});
