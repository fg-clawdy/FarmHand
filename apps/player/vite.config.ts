import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "art/*"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,webp,ico,webmanifest}"],
        globIgnores: ["**/art/painted/plants/**"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/admin/, /^\/api/, /^\/health/],
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
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
});
