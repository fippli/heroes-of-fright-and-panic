import express from "express";
import { Database, Game } from "../../database";
import type { Filter } from "mongodb";
import { ObjectId } from "mongodb";
import { GameMap } from "../../../shared/map/map";
import { compose } from "@shared/utils/compose";
import { Piece } from "@shared/piece";
import { Player } from "@shared/player";
import { Tile } from "@shared/map/tile";
import { ResourceMap } from "@shared/player/resource-map";

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

    const center = Math.floor(boardSize / 2);

    const dayPlayer = new Player({
      type: "day",
      resources: new ResourceMap({}),
    });
    const nightPlayer = new Player({
      type: "night",
      resources: new ResourceMap({}),
    });

    const tiles = compose(
      (tiles: Tile[]): Tile[] => {
        return GameMap.replaceTile(
          {
            row: Math.floor(Math.random() * center),
            column: Math.floor(Math.random() * center),
            piece: Piece.peasant(dayPlayer),
          },
          tiles,
        );
      },
      (tiles) => {
        return GameMap.replaceTile(
          {
            row: Math.floor(Math.random() * center),
            column: Math.floor(Math.random() * center),
            piece: Piece.peasant(nightPlayer),
          },
          tiles,
        );
      },
    )(GameMap.generate(boardSize)) as Tile[];

    const result = await games.create({
      createdAt: now,
      updatedAt: now,

      size: boardSize,
      tiles: tiles,
      player: dayPlayer,
      dayPlayer,
      nightPlayer,
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

gameRouter.post("/:gameId/click", async (req, res) => {
  console.log("clicked", req.body);

  res.json({ clicked: req.body });
});

export default gameRouter;
