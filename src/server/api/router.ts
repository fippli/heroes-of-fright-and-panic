import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./auth/router";
import gameRouter from "./game/router";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const apiRouter = express.Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/game", gameRouter);

apiRouter.get("/", (_req, res) => {
  res.sendFile(path.resolve(thisDir, "./api.html"));
});

// API routes go here - for now just health check
apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.get("/{*splat}", (_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

export default apiRouter;
