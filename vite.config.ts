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
        // Landing page
        landing: path.resolve(__dirname, "src/client/pages/landing/index.html"),
        // Sign in page
        signin: path.resolve(__dirname, "src/client/pages/signin/index.html"),
        // Games list page
        games: path.resolve(__dirname, "src/client/pages/games/index.html"),
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
