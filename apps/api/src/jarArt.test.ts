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

  it("decodes a Venice JSON image (resolution-tier default model)", async () => {
    const png = Buffer.from("fake-png-bytes-that-are-long-enough-for-the-check");
    const result = await paintJarLid({
      prompt: "sage jar",
      apiKey: "test-key",
      fetcher: async (input, init) => {
        assert.match(String(input), /\/image\/generate$/);
        const body = JSON.parse(String(init?.body)) as {
          safe_mode: boolean;
          model: string;
          aspect_ratio?: string;
          resolution?: string;
          width?: number;
        };
        assert.equal(body.safe_mode, true);
        assert.equal(body.model, "flux-3-image");
        assert.equal(body.aspect_ratio, "1:1");
        assert.equal(body.resolution, "1K");
        assert.equal(body.width, undefined);
        return new Response(JSON.stringify({ images: [png.toString("base64")] }), { status: 200 });
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.png.toString(), png.toString());
  });

  it("sends pixel sizing for width/height-based image models", async () => {
    const previous = process.env.VENICE_IMAGE_MODEL;
    process.env.VENICE_IMAGE_MODEL = "z-image-turbo";
    try {
      const png = Buffer.from("fake-png-bytes-that-are-long-enough-for-the-check");
      const result = await paintJarLid({
        prompt: "clay jar",
        apiKey: "test-key",
        fetcher: async (input, init) => {
          assert.match(String(input), /\/image\/generate$/);
          const body = JSON.parse(String(init?.body)) as {
            width?: number;
            height?: number;
            aspect_ratio?: string;
          };
          assert.equal(body.width, 512);
          assert.equal(body.height, 512);
          assert.equal(body.aspect_ratio, undefined);
          return new Response(JSON.stringify({ images: [png.toString("base64")] }), { status: 200 });
        },
      });
      assert.equal(result.ok, true);
    } finally {
      if (previous === undefined) delete process.env.VENICE_IMAGE_MODEL;
      else process.env.VENICE_IMAGE_MODEL = previous;
    }
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
