import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./api/router";
import clientRouter from "./client/router";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const app = express();
const PORT = process.env.PORT || 3000;

app.use("/api", apiRouter);

const imgDir = path.resolve(thisDir, "../static/img");
app.use("/img", express.static(imgDir));

app.use("/", clientRouter);

// Fallback to index.html for client-side routing
app.get("/{*splat}", (_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
