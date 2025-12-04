import express from "express";
import { Database, Game } from "../../database";
import type { Filter } from "mongodb";
import { ObjectId } from "mongodb";
import { GameMap } from "@shared/map/map";
import { compose } from "@shared/utils/compose";
import { Piece } from "@shared/piece";
import { Player } from "@shared/player";
import { Tile } from "@shared/map/tile";
import { ResourceMap } from "@shared/player/resource-map";
import type { GameAction } from "@shared/actions";
import { processAction } from "../../game/actions";

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
    const boardSize = req.body.size || 15;

    const now = new Date();

    const center = Math.floor(boardSize / 2);

    const dayPlayer = new Player({
      type: "day",
      resources: new ResourceMap({ wood: 5, stone: 2 }), // Starting resources
    });
    const nightPlayer = new Player({
      type: "night",
      resources: new ResourceMap({ wood: 5, stone: 2 }), // Starting resources
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
            row:
              center + Math.floor(Math.random() * (boardSize - center)),
            column:
              center + Math.floor(Math.random() * (boardSize - center)),
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
      currentPlayer: "day", // Day player starts
      clock: {
        time: 6, // Start at 6:00 (morning)
        hasDawned: true,
        hasDusked: false,
      },
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

// GET /:gameId → get game state
gameRouter.get("/:gameId", async (req, res) => {
  try {
    const games = database.games();
    const game = await games.findOne({
      _id: new ObjectId(req.params.gameId),
    } as Filter<Game>);

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    // Return game state with ID as string for client convenience
    res.json({
      ...game,
      id: game._id.toString(),
    });
  } catch (err) {
    console.error("Error fetching game:", err);
    res.status(500).json({ error: "Failed to fetch game" });
  }
});

// POST /:gameId/action → process a game action
gameRouter.post("/:gameId/action", async (req, res) => {
  try {
    const games = database.games();
    const gameId = new ObjectId(req.params.gameId);

    // Fetch current game state
    const game = await games.findOne({ _id: gameId } as Filter<Game>);

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const action: GameAction = req.body;

    // Validate action has required fields
    if (!action.type || !action.player) {
      res.status(400).json({ error: "Invalid action: missing type or player" });
      return;
    }

    // Process the action
    const { result, updatedGame } = processAction(game, action);

    if (result.success) {
      // Save updated game state
      await games.updateOne(
        { _id: gameId } as Filter<Game>,
        {
          $set: {
            tiles: updatedGame.tiles,
            dayPlayer: updatedGame.dayPlayer,
            nightPlayer: updatedGame.nightPlayer,
            currentPlayer: updatedGame.currentPlayer,
            clock: updatedGame.clock,
            updatedAt: new Date(),
          },
        },
      );
    }

    // Return result and updated game state
    res.json({
      result,
      game: {
        ...updatedGame,
        id: updatedGame._id.toString(),
      },
    });
  } catch (err) {
    console.error("Error processing action:", err);
    res.status(500).json({ error: "Failed to process action" });
  }
});

// Keep the old click endpoint for backwards compatibility (deprecated)
gameRouter.post("/:gameId/click", async (req, res) => {
  console.log("⚠️ Deprecated: Use POST /:gameId/action instead");
  res.json({
    warning: "This endpoint is deprecated. Use POST /:gameId/action instead.",
    clicked: req.body,
  });
});

export default gameRouter;
