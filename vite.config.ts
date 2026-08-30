import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { execSync } from "node:child_process";

const appVersion = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  test: {
    // supabase/functions/shared is a generated copy of src/shared (pnpm copy:shared)
    exclude: ["**/node_modules/**", "**/dist/**", "supabase/functions/shared/**"],
  },
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  publicDir: "static",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
