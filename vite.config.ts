import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  publicDir: path.resolve(__dirname, "static"),
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Main SPA entry point
        main: path.resolve(__dirname, "src/client/index.html"),
        // Game canvas page (still separate as it uses vanilla JS)
        game: path.resolve(__dirname, "src/client/pages/game/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@static": path.resolve(__dirname, "src/server/static"),
    },
  },
});
