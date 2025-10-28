import express from "express";
import { Database } from "../../database";

const gameRouter = express.Router();

const database = new Database();

// ensure DB is connected before handling requests
database
  .connect()
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
  });

// POST / → create a new game and redirect
gameRouter.post("/", async (_req, res) => {
  try {
    const games = database.games();

    const now = new Date();
    const result = await games.create({
      createdAt: now,
      updatedAt: now,
    });

    // redirect to the new game path
    res.redirect(`/game/${result.insertedId}`);
  } catch (err) {
    console.error("Error creating game:", err);
    res.status(500).json({ error: "Failed to create game" });
  }
});

export default gameRouter;
