import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: "src/client",
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@static": path.resolve(__dirname, "static"),
    },
  },
});
