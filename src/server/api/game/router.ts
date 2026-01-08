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
import type { GameAction, PlayerType } from "@shared/actions";
import { processAction } from "../../game/actions";
import { GameEngine } from "../../game/engine";

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

/**
 * Helper function to get current user from session
 */
const getCurrentUser = async (
  req: express.Request,
): Promise<{ email: string; id: string } | null> => {
  try {
    const sessionId = req.cookies?.session;
    if (!sessionId) {
      return null;
    }

    const session = await database.sessions().findOne({ sessionId });
    if (!session || new Date() > session.expiresAt) {
      return null;
    }

    const user = await database.users().findOne({ _id: session.userId });
    if (!user) {
      return null;
    }

    return {
      email: user.email,
      id: user._id.toString(),
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

// GET / → list all games
gameRouter.get("/", async (req, res) => {
  try {
    const games = database.games();
    const db = database.db;

    // Get all games, sorted by most recent first
    const gamesList = await db
      .collection("games")
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Return simplified game info with player emails and last moves
    const gamesResponse = gamesList.map((game: any) => ({
      id: game._id.toString(),
      size: game.size,
      currentPlayer: game.currentPlayer,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      creatorEmail: game.creatorEmail || null,
      dayPlayerEmail: game.dayPlayerEmail || null,
      nightPlayerEmail: game.nightPlayerEmail || null,
      dayPlayerLastMove: game.dayPlayerLastMove || null,
      nightPlayerLastMove: game.nightPlayerLastMove || null,
    }));

    res.json(gamesResponse);
  } catch (err) {
    console.error("Error listing games:", err);
    res.status(500).json({ error: "Failed to list games" });
  }
});

// POST / → create a new game and redirect
gameRouter.post("/", async (req, res) => {
  try {
    // Get current user
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const games = database.games();
    const boardSize = req.body.size || 15;
    const name = req.body.name || `Game ${new Date().toISOString()}`;
    const alliance = req.body.alliance || "day"; // "day" or "night"
    const inviteEmail = req.body.inviteEmail || null;

    const now = new Date();

    const dayPlayer = new Player({
      type: "day",
      resources: new ResourceMap({ wood: 5, stone: 2 }), // Starting resources
    });
    const nightPlayer = new Player({
      type: "night",
      resources: new ResourceMap({ wood: 5, stone: 2 }), // Starting resources
    });

    // Generate the map first
    let tiles = GameMap.generate(boardSize) as Tile[];

    // Find all grass tiles
    const grassTiles = tiles.filter((tile) => tile.landscape?.type === "grass");

    // Find grass tile closest to lower-left corner (high row, low column) for Day player
    // Distance from lower-left = sqrt((maxRow - row)^2 + column^2)
    const maxRow = boardSize - 1;
    const maxCol = boardSize - 1;

    let dayStartTile = grassTiles[0];
    let minDayDistance = Infinity;

    for (const tile of grassTiles) {
      // Distance from lower-left corner (maxRow, 0)
      const distance = Math.sqrt(
        Math.pow(maxRow - tile.row, 2) + Math.pow(tile.column, 2),
      );
      if (distance < minDayDistance) {
        minDayDistance = distance;
        dayStartTile = tile;
      }
    }

    // Find grass tile closest to upper-right corner (low row, high column) for Night player
    let nightStartTile = grassTiles[0];
    let minNightDistance = Infinity;

    for (const tile of grassTiles) {
      // Distance from upper-right corner (0, maxCol)
      const distance = Math.sqrt(
        Math.pow(tile.row, 2) + Math.pow(maxCol - tile.column, 2),
      );
      if (distance < minNightDistance) {
        minNightDistance = distance;
        nightStartTile = tile;
      }
    }

    // Place Day player's peasant at lower-left grass tile
    tiles = GameMap.replaceTile(
      {
        row: dayStartTile.row,
        column: dayStartTile.column,
        piece: Piece.peasant(dayPlayer),
      },
      tiles,
    ) as Tile[];

    // Place Night player's peasant at upper-right grass tile
    tiles = GameMap.replaceTile(
      {
        row: nightStartTile.row,
        column: nightStartTile.column,
        piece: Piece.peasant(nightPlayer),
      },
      tiles,
    ) as Tile[];

    // Assign creator to selected alliance, invited player to opposite
    const dayPlayerEmail =
      alliance === "day" ? user.email : inviteEmail || null;
    const nightPlayerEmail =
      alliance === "night" ? user.email : inviteEmail || null;

    const result = await games.create({
      createdAt: now,
      updatedAt: now,
      size: boardSize,
      name: name,
      tiles: tiles,
      currentPlayer: "day", // Day player starts
      clock: {
        time: 6, // Start at 6:00 (morning)
        hasDawned: true,
        hasDusked: false,
      },
      dayPlayer,
      nightPlayer,
      creatorEmail: user.email,
      dayPlayerEmail,
      nightPlayerEmail,
      dayPlayerLastMove: null,
      nightPlayerLastMove: null,
      invitedEmail: inviteEmail,
    });

    const gameId = result.insertedId.toString();

    // If request accepts JSON (API call), return JSON
    if (req.accepts("json") && req.is("application/json")) {
      res.json({
        id: gameId,
        name: name,
        size: boardSize,
        currentPlayer: "day",
        createdAt: now,
      });
      return;
    }

    // Otherwise redirect to the new game path (form submission)
    res.redirect(`/game/${gameId}?player=${alliance}`);
  } catch (err) {
    console.error("Error creating game:", err);
    res.status(500).json({ error: "Failed to create game" });
  }
});

// GET /:gameId → get game state
// Query params:
//   - player: "day" | "night" - which player's perspective to return (filtered fog of war)
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

    // Get player perspective from query param
    const playerParam = req.query.player as string | undefined;

    // Validate player param if provided
    if (playerParam && playerParam !== "day" && playerParam !== "night") {
      res
        .status(400)
        .json({ error: "Invalid player parameter. Must be 'day' or 'night'" });
      return;
    }

    const playerType = playerParam as PlayerType | undefined;

    // If player is specified, return filtered game state (fog of war)
    if (playerType) {
      const engine = new GameEngine(game);
      const filteredGame = engine.getFilteredGameState(playerType);

      res.json({
        ...filteredGame,
        id: filteredGame._id.toString(),
        viewingAs: playerType, // Let client know which player they are
      });
      return;
    }

    // No player specified - return full game state (for debugging/spectating)
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
// The action.player field determines whose turn it is and what filtered view to return
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
    const { result, updatedGame } = processAction({ game, action });

    if (result.success) {
      // Get current user to track last move
      const user = await getCurrentUser(req);
      const now = new Date();

      // Determine which player's last move to update
      const updateFields: any = {
        tiles: updatedGame.tiles,
        dayPlayer: updatedGame.dayPlayer,
        nightPlayer: updatedGame.nightPlayer,
        currentPlayer: updatedGame.currentPlayer,
        clock: updatedGame.clock,
        updatedAt: now,
      };

      // Update last move timestamp for the player who made the action
      if (user && action.player === "day") {
        updateFields.dayPlayerLastMove = now;
      } else if (user && action.player === "night") {
        updateFields.nightPlayerLastMove = now;
      }

      // Save updated game state
      await games.updateOne({ _id: gameId } as Filter<Game>, {
        $set: updateFields,
      });
    }

    // Return filtered game state for the player who made the action
    const engine = new GameEngine(updatedGame);
    const filteredGame = engine.getFilteredGameState(action.player);

    res.json({
      result,
      game: {
        ...filteredGame,
        id: filteredGame._id.toString(),
        viewingAs: action.player,
      },
    });
  } catch (err) {
    console.error("Error processing action:", err);
    res.status(500).json({ error: "Failed to process action" });
  }
});

// POST /:gameId/join → join a game as night player
gameRouter.post("/:gameId/join", async (req, res) => {
  try {
    // Get current user
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const games = database.games();
    const gameId = new ObjectId(req.params.gameId);

    // Fetch current game state
    const game = await games.findOne({ _id: gameId } as Filter<Game>);

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    // Check if night player slot is already taken
    if (game.nightPlayerEmail && game.nightPlayerEmail !== user.email) {
      res.status(403).json({ error: "Night player slot is already taken" });
      return;
    }

    // Check if user is already the day player
    if (game.dayPlayerEmail === user.email) {
      res.status(400).json({ error: "You are already the day player" });
      return;
    }

    // Join as night player
    await games.updateOne({ _id: gameId } as Filter<Game>, {
      $set: {
        nightPlayerEmail: user.email,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, message: "Joined game as night player" });
  } catch (err) {
    console.error("Error joining game:", err);
    res.status(500).json({ error: "Failed to join game" });
  }
});

// DELETE /:gameId → delete a game (only creator can delete)
gameRouter.delete("/:gameId", async (req, res) => {
  try {
    // Get current user
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const games = database.games();
    const gameId = new ObjectId(req.params.gameId);

    // Fetch current game state
    const game = await games.findOne({ _id: gameId } as Filter<Game>);

    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    // Check if user is the creator
    if (game.creatorEmail !== user.email) {
      res
        .status(403)
        .json({ error: "Only the game creator can delete this game" });
      return;
    }

    // Delete the game
    await games.deleteOne({ _id: gameId } as Filter<Game>);

    res.json({ success: true, message: "Game deleted successfully" });
  } catch (err) {
    console.error("Error deleting game:", err);
    res.status(500).json({ error: "Failed to delete game" });
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
