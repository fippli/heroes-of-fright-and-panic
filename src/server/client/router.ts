import express from "express";
import { fileURLToPath } from "url";
import path from "path";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const clientRouter = express.Router();

clientRouter.get("/", (_req, res) => {
  res.sendFile(path.resolve(thisDir, "./index.html"));
});

clientRouter.get("/game/create", (_req, res) => {
  res.sendFile(path.resolve(thisDir, "./create.html"));
});

// send client index.html
clientRouter.get("/game/:gameId", (_req, res) => {
  res.sendFile(path.resolve(thisDir, "../../client/index.html"));
});

clientRouter.get("/{*splat}", (_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

export default clientRouter;
