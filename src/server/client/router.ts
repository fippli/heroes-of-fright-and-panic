import express from "express";
import { fileURLToPath } from "url";
import path from "path";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const clientRouter = express.Router();

// Base path to built client folder
const builtClientDir = path.resolve(thisDir, "../../../dist/client");

// Serve static assets (images, etc.) under /img
clientRouter.use(
  "/img",
  express.static(path.join(builtClientDir, "img"), { index: false }),
);

// Serve all other built client assets (JS, CSS, etc.)
clientRouter.use(express.static(builtClientDir, { index: false }));

// Magic link verification redirect (redirects to API endpoint)
clientRouter.get("/auth/verify", (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.redirect("/signin?error=invalid_token");
    return;
  }
  // Redirect to API endpoint which handles verification and sets cookie
  res.redirect(`/api/auth/verify?token=${token}`);
});

// Landing page (home)
clientRouter.get("/", (_req, res) => {
  res.sendFile(path.join(builtClientDir, "pages/landing/index.html"));
});

// Sign in page
clientRouter.get("/signin", (_req, res) => {
  res.sendFile(path.join(builtClientDir, "pages/signin/index.html"));
});

// Games list page
clientRouter.get("/games", (_req, res) => {
  res.sendFile(path.join(builtClientDir, "pages/games/index.html"));
});

// Legacy create route - redirect to games
clientRouter.get("/create", (_req, res) => {
  res.redirect("/games");
});

// Game page - matches /game/:id
clientRouter.get("/game/:id", (_req, res) => {
  res.sendFile(path.join(builtClientDir, "pages/game/index.html"));
});

// SPA fallback — any other GET serves game page (for deep links)
clientRouter.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(builtClientDir, "pages/game/index.html"));
});

export default clientRouter;
