import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/admin/, /^\/api/, /^\/health/],
      },
      manifest: {
        name: "FarmHand",
        short_name: "FarmHand",
        description: "A shared homestead garden for the family tablet.",
        theme_color: "#9B2C1F",
        background_color: "#7EC8E3",
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
