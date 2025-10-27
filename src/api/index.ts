import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static image files from /img directory
const imgDir = path.resolve(__dirname, "../../static/img");
app.use("/img", express.static(imgDir));

// Serve static files from Vite build
const staticDir = path.resolve(__dirname, "../../static/web-client");
app.use(express.static(staticDir));

// API routes go here - for now just health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Fallback to index.html for client-side routing
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Serving static files from: ${staticDir}`);
});
