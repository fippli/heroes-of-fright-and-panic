import express from "express";
import session from "express-session";
import passport from "passport";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./api/router";
import clientRouter from "./client/router";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);

const app = express();
const PORT = process.env.PORT || 3000;

// Session configuration
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware: parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Optional: parse JSON bodies if you accept JSON also
app.use(express.json());

app.use("/api", apiRouter);

const imgDir = path.resolve(thisDir, "../../static/img");
app.use("/img", express.static(imgDir));

const cssDir = path.resolve(thisDir, "../../static/css");
app.use("/css", express.static(cssDir));

app.use("/", clientRouter);

// Fallback to index.html for client-side routing
app.get("/{*splat}", (_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
