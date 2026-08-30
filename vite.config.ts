import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    // supabase/functions/shared is a generated copy of src/shared (pnpm copy:shared)
    exclude: ["**/node_modules/**", "**/dist/**", "supabase/functions/shared/**"],
  },
  plugins: [react()],
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
