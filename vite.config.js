import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  root: "src/web-client",
  build: {
    outDir: "../../static/web-client",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/web-client/index.html"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
