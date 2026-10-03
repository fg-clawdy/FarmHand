import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { patchPixiWebGL1AttribSource } from "./src/pixi/webglBoot";

/** Dead-code the WebGL1 bindAttribLocation relink. Dev prebundle and prod rollup. */
function pixiWebgl1AttribPlugin(): Plugin {
  return {
    name: "farmhand-pixi-webgl1-attribs",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("extractAttributesFromGlProgram")) return null;
      const next = patchPixiWebGL1AttribSource(code);
      if (next === code) return null;
      return { code: next, map: null };
    },
  };
}

function pixiWebgl1AttribEsbuildPlugin() {
  return {
    name: "farmhand-pixi-webgl1-attribs",
    setup(build: {
      onLoad: (
        options: { filter: RegExp },
        cb: (args: { path: string }) => Promise<{ contents: string; loader: "js" }>,
      ) => void;
    }) {
      build.onLoad({ filter: /extractAttributesFromGlProgram\.m?js$/ }, async (args) => {
        const { readFileSync } = await import("node:fs");
        return {
          contents: patchPixiWebGL1AttribSource(readFileSync(args.path, "utf8")),
          loader: "js" as const,
        };
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const routerBuild = command === "serve" ? "development" : "production";
  return {
    plugins: [
      pixiWebgl1AttribPlugin(),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg", "art/*"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp,ico,webmanifest}"],
          globIgnores: ["**/art/painted/plants/**"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/admin/, /^\/parent/, /^\/api/, /^\/health/],
          runtimeCaching: [
            {
              urlPattern: /\/art\/painted\/plants\/.*/,
              handler: "NetworkFirst",
              options: { cacheName: "farmhand-crop-sheets" },
            },
          ],
        },
        manifest: {
          name: "FarmHand",
          short_name: "FarmHand",
          description: "A shared homestead garden for the family tablet.",
          theme_color: "#9B2C1F",
          background_color: "#3d8a32",
          display: "standalone",
          orientation: "landscape",
          start_url: "/",
          icons: [
            { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        // Pin the ESM build. The CJS .js files drop named exports like useNavigate.
        "react-router/dom": fileURLToPath(
          new URL(`../../node_modules/react-router/dist/${routerBuild}/dom-export.mjs`, import.meta.url),
        ),
        "react-router": fileURLToPath(
          new URL(`../../node_modules/react-router/dist/${routerBuild}/index.mjs`, import.meta.url),
        ),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        plugins: [pixiWebgl1AttribEsbuildPlugin()],
      },
    },
    server: {
      proxy: { "/api": "http://localhost:3000" },
    },
  };
});
