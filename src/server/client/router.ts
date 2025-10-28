import express from "express";
import { fileURLToPath } from "url";
import path from "path";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const clientRouter = express.Router();

// Base path to built client folder
const builtClientDir = path.resolve(thisDir, "../../../dist/client");

// Serve static assets under /static
clientRouter.use(
  "/static",
  express.static(path.join(builtClientDir, "static"), { index: false }),
);

// Serve all other built client assets (JS, CSS, images)
clientRouter.use(express.static(builtClientDir, { index: false }));

clientRouter.get("/", (_req, res) => {
  res.sendFile(path.join(thisDir, "index.html"));
});

// Explicit route for /create → create.html
clientRouter.get("/create", (_req, res) => {
  res.sendFile(path.join(thisDir, "create.html"));
});

// SPA fallback — any other GET (except /api etc) serve index.html
clientRouter.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(builtClientDir, "index.html"));
});

export default clientRouter;
