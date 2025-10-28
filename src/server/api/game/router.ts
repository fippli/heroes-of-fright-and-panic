import express from "express";
import { Database, Game } from "../../database";
import type { Filter } from "mongodb";
import { ObjectId } from "mongodb";
import { GameMap } from "../../../shared/map/map";

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
gameRouter.post("/", async (req, res) => {
  try {
    const games = database.games();
    const boardSize = req.body.size;

    const now = new Date();
    const result = await games.create({
      createdAt: now,
      updatedAt: now,
      board: {
        size: boardSize,
        tiles: GameMap.generate(boardSize),
      },
    });

    // redirect to the new game path
    res.redirect(`/game/${result.insertedId}`);
  } catch (err) {
    console.error("Error creating game:", err);
    res.status(500).json({ error: "Failed to create game" });
  }
});

gameRouter.get("/:gameId", async (_req, res) => {
  const games = database.games();
  const game = await games.findOne({
    _id: new ObjectId(_req.params.gameId),
  } as Filter<Game>);
  res.json(game);
});

export default gameRouter;
