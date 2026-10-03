import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const CHROME = [
  "/usr/bin/google-chrome",
  "/usr/local/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
].find((path) => existsSync(path));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort(): Promise<number> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode != null) return;
  child.kill("SIGKILL");
}

test(
  "QA garden canvas mounts a real stage instead of a flat green clear",
  { skip: CHROME ? false : "chrome is not installed", timeout: 60_000 },
  async () => {
    const port = await freePort();
    const vite = spawn(
      "npx",
      ["vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
      { cwd: join(import.meta.dirname, "../.."), stdio: "ignore" },
    );
    const profile = mkdtempSync(join(tmpdir(), "fh-garden-"));
    const debugPort = 9344;
    let chrome: ChildProcess | undefined;
    let ws: WebSocket | undefined;
    try {
      let up = false;
      for (let i = 0; i < 40; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/qa/garden?pack=willow`);
          if (res.ok) {
            up = true;
            break;
          }
        } catch {
          /* vite still booting */
        }
        await sleep(250);
      }
      assert.equal(up, true, "player dev server did not start");

      chrome = spawn(
        CHROME!,
        [
          "--headless=new",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--use-gl=angle",
          `--remote-debugging-port=${debugPort}`,
          `--user-data-dir=${profile}`,
          "--window-size=1280,800",
          "about:blank",
        ],
        { stdio: "ignore" },
      );

      let targets: Array<{ type: string; webSocketDebuggerUrl: string }> = [];
      for (let i = 0; i < 40; i++) {
        try {
          const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
          if (res.ok) {
            targets = (await res.json()) as typeof targets;
            if (targets.some((t) => t.type === "page")) break;
          }
        } catch {
          /* chrome still booting */
        }
        await sleep(150);
      }
      const page = targets.find((t) => t.type === "page");
      assert.ok(page, "chrome did not expose a page target");

      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise<void>((resolve, reject) => {
        ws!.addEventListener("open", () => resolve());
        ws!.addEventListener("error", () => reject(new Error("chrome websocket failed")));
      });
      let id = 0;
      const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
      ws.addEventListener("message", (ev) => {
        const msg = JSON.parse(String(ev.data)) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
        };
        if (!msg.id || !pending.has(msg.id)) return;
        const waiter = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(msg.error.message || "cdp error"));
        else waiter.resolve(msg.result);
      });
      const send = (method: string, params: Record<string, unknown> = {}) => {
        const msgId = ++id;
        ws!.send(JSON.stringify({ id: msgId, method, params }));
        return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
      };

      await send("Page.enable");
      await send("Runtime.enable");
      await send("Page.navigate", { url: `http://127.0.0.1:${port}/qa/garden?pack=willow` });

      let scene: {
        scene: string | null;
        webgl: string | null;
        stage: string | null;
        canvas: { w: number; h: number } | null;
        error: string | null;
      } | null = null;
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        const evaled = (await send("Runtime.evaluate", {
          expression: `(() => {
            const host = document.querySelector(".pixi-host");
            const canvas = host?.querySelector("canvas");
            return {
              scene: host?.dataset.farmhandScene || null,
              webgl: host?.dataset.farmhandWebgl || null,
              stage: host?.dataset.farmhandStage || null,
              canvas: canvas ? { w: canvas.width, h: canvas.height } : null,
              error: document.querySelector(".garden-load-error-reason")?.textContent || null,
            };
          })()`,
          returnByValue: true,
        })) as { result?: { value?: typeof scene } };
        scene = evaled.result?.value ?? null;
        if (scene?.scene) break;
      }

      assert.ok(scene, "garden page did not report a present status");
      assert.equal(scene.error, null);
      assert.equal(
        scene.scene,
        "scene-drawn",
        `expected a painted stage, got ${scene.scene} (webgl ${scene.webgl})`,
      );
      assert.ok(scene.canvas && scene.canvas.w >= 32 && scene.canvas.h >= 32, "canvas backing store is tiny");
      assert.equal(Number(scene.stage) >= 1, true, "pixi stage has no root");
      // 1 or 2 is WebGL. 0 is Pixi's canvas fallback (still must paint, not clear-only).
      assert.ok(
        scene.webgl === "0" || scene.webgl === "1" || scene.webgl === "2",
        `unexpected webgl version ${scene.webgl}`,
      );
    } finally {
      ws?.close();
      stop(chrome);
      stop(vite);
      await sleep(200);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* Chrome may still be releasing the profile directory. */
      }
    }
  },
);
