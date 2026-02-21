import express from "express";
import {
  supabaseAdmin,
  Game,
  GameRow,
  rowToGame,
  gameToRow,
} from "../../database/supabase";
import { GameMap } from "@shared/map/map";
import { Piece } from "@shared/piece";
import { Player } from "@shared/player";
import { Tile } from "@shared/map/tile";
import { ResourceMap } from "@shared/player/resource-map";
import type { GameAction, PlayerType } from "@shared/actions";
import { processAction } from "@shared/game/actions";
import { GameEngine } from "@shared/game/engine";

const gameRouter = express.Router();

/**
 * Helper function to get current user from Supabase token in cookies
 */
const getCurrentUser = async (
  req: express.Request,
): Promise<{ email: string; id: string } | null> => {
  try {
    const accessToken = req.cookies?.["sb-access-token"];
    if (accessToken == null) {
      return null;
    }

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (error != null || user == null || user.email == null) {
      return null;
    }

    return {
      email: user.email,
      id: user.id,
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

// GET / → list user's games
gameRouter.get("/", async (req, res) => {
  try {
    // Authenticate user
    const user = await getCurrentUser(req);
    if (user == null) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Get only games that the user is involved in
    const { data: gamesList, error } = await supabaseAdmin
      .from("games")
      .select("*")
      .or(
        `creator_email.eq.${user.email},day_player_email.eq.${user.email},night_player_email.eq.${user.email},invited_email.eq.${user.email}`,
      )
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error listing games:", error);
      res.status(500).json({ error: "Failed to list games" });
      return;
    }

    // Return simplified game info with player emails and last moves
    const gamesResponse = (gamesList ?? []).map((game: GameRow) => ({
      id: game.id,
      size: game.size,
      currentPlayer: game.current_player,
      createdAt: game.created_at,
      updatedAt: game.updated_at,
      creatorEmail: game.creator_email ?? null,
      dayPlayerEmail: game.day_player_email ?? null,
      nightPlayerEmail: game.night_player_email ?? null,
      dayPlayerLastMove: game.day_player_last_move ?? null,
      nightPlayerLastMove: game.night_player_last_move ?? null,
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
    if (user == null) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const boardSize = req.body.size ?? 15;
    const name = req.body.name ?? `Game ${new Date().toISOString()}`;
    const alliance = req.body.alliance ?? "day"; // "day" or "night"
    const inviteEmail = req.body.inviteEmail ?? null;

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
    const generatedTiles = GameMap.generate(boardSize) as Tile[];

    // Find all grass tiles
    const grassTiles = generatedTiles.filter((tile) => tile.landscape?.type === "grass");

    // Find grass tile closest to lower-left corner (high row, low column) for Day player
    const maxRow = boardSize - 1;
    const maxCol = boardSize - 1;

    const dayStartTile = grassTiles.reduce((closest, tile) => {
      const distance = Math.sqrt(
        Math.pow(maxRow - tile.row, 2) + Math.pow(tile.column, 2),
      );
      const closestDistance = Math.sqrt(
        Math.pow(maxRow - closest.row, 2) + Math.pow(closest.column, 2),
      );
      return distance < closestDistance ? tile : closest;
    }, grassTiles.at(0)!);

    // Find grass tile closest to upper-right corner (low row, high column) for Night player
    const nightStartTile = grassTiles.reduce((closest, tile) => {
      const distance = Math.sqrt(
        Math.pow(tile.row, 2) + Math.pow(maxCol - tile.column, 2),
      );
      const closestDistance = Math.sqrt(
        Math.pow(closest.row, 2) + Math.pow(maxCol - closest.column, 2),
      );
      return distance < closestDistance ? tile : closest;
    }, grassTiles.at(0)!);

    // Place Day player's peasant at lower-left grass tile
    const tilesWithDayPlayer = GameMap.replaceTile(
      {
        row: dayStartTile.row,
        column: dayStartTile.column,
        piece: Piece.peasant(dayPlayer),
      },
      generatedTiles,
    ) as Tile[];

    // Place Night player's peasant at upper-right grass tile
    const tiles = GameMap.replaceTile(
      {
        row: nightStartTile.row,
        column: nightStartTile.column,
        piece: Piece.peasant(nightPlayer),
      },
      tilesWithDayPlayer,
    ) as Tile[];

    // Assign creator to selected alliance, invited player to opposite
    const dayPlayerEmail =
      alliance === "day" ? user.email : inviteEmail ?? null;
    const nightPlayerEmail =
      alliance === "night" ? user.email : inviteEmail ?? null;

    // Insert into Supabase
    const { data: newGame, error } = await supabaseAdmin
      .from("games")
      .insert({
        name: name,
        size: boardSize,
        tiles: tiles,
        day_player: dayPlayer,
        night_player: nightPlayer,
        current_player: "day",
        clock: {
          time: 6,
          hasDawned: true,
          hasDusked: false,
        },
        creator_email: user.email,
        day_player_email: dayPlayerEmail,
        night_player_email: nightPlayerEmail,
        day_player_last_move: null,
        night_player_last_move: null,
        invited_email: inviteEmail,
        game_over: false,
        winner: null,
      })
      .select()
      .single();

    if (error != null || newGame == null) {
      console.error("Error creating game:", error);
      res.status(500).json({ error: "Failed to create game" });
      return;
    }

    const gameId = newGame.id;

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
    const { data: gameRow, error } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", req.params.gameId)
      .single();

    if (error != null || gameRow == null) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const game = rowToGame(gameRow);

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
        id: filteredGame.id,
        viewingAs: playerType, // Let client know which player they are
      });
      return;
    }

    // No player specified - return full game state (for debugging/spectating)
    res.json({
      ...game,
      id: game.id,
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
    // Authenticate user
    const user = await getCurrentUser(req);
    if (user == null) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const gameId = req.params.gameId;

    // Fetch current game state
    const { data: gameRow, error: fetchError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (fetchError != null || gameRow == null) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const game = rowToGame(gameRow);
    const action: GameAction = req.body;

    // Validate action has required fields
    if (action.type == null || action.player == null) {
      res.status(400).json({ error: "Invalid action: missing type or player" });
      return;
    }

    // Verify user is authorized to play as the claimed player
    const playerEmail =
      action.player === "day" ? game.dayPlayerEmail : game.nightPlayerEmail;
    if (playerEmail !== user.email) {
      res
        .status(403)
        .json({ error: `You are not authorized to play as ${action.player}` });
      return;
    }

    // Block actions on games that are over
    if (game.gameOver) {
      res.status(400).json({
        error: "Game is over",
        winner: game.winner,
      });
      return;
    }

    // Process the action
    const { result, updatedGame } = processAction({ game, action });

    if (result.success) {
      const now = new Date();

      // Determine which player's last move to update
      const updateFields: Partial<Game> = {
        tiles: updatedGame.tiles,
        dayPlayer: updatedGame.dayPlayer,
        nightPlayer: updatedGame.nightPlayer,
        currentPlayer: updatedGame.currentPlayer,
        clock: updatedGame.clock,
        updatedAt: now,
        gameOver: updatedGame.gameOver ?? false,
        winner: updatedGame.winner ?? null,
      };

      // Update last move timestamp for the player who made the action
      if (user && action.player === "day") {
        updateFields.dayPlayerLastMove = now;
      } else if (user && action.player === "night") {
        updateFields.nightPlayerLastMove = now;
      }

      // Save updated game state
      const { error: updateError } = await supabaseAdmin
        .from("games")
        .update(gameToRow(updateFields))
        .eq("id", gameId);

      if (updateError) {
        console.error("Error updating game:", updateError);
      }
    }

    // Return filtered game state for the player who made the action
    const engine = new GameEngine(updatedGame);
    const filteredGame = engine.getFilteredGameState(action.player);

    res.json({
      result,
      game: {
        ...filteredGame,
        id: filteredGame.id,
        viewingAs: action.player,
      },
    });
  } catch (err) {
    console.error("Error processing action:", err);
    res.status(500).json({ error: "Failed to process action" });
  }
});

// POST /:gameId/join → join a game as the invited player
gameRouter.post("/:gameId/join", async (req, res) => {
  try {
    // Get current user
    const user = await getCurrentUser(req);
    if (user == null) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const gameId = req.params.gameId;

    // Fetch current game state
    const { data: gameRow, error: fetchError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (fetchError != null || gameRow == null) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const game = rowToGame(gameRow);

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
    const { error: updateError } = await supabaseAdmin
      .from("games")
      .update({
        night_player_email: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", gameId);

    if (updateError) {
      console.error("Error joining game:", updateError);
      res.status(500).json({ error: "Failed to join game" });
      return;
    }

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
    if (user == null) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const gameId = req.params.gameId;

    // Fetch current game state
    const { data: gameRow, error: fetchError } = await supabaseAdmin
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (fetchError != null || gameRow == null) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const game = rowToGame(gameRow);

    // Check if user is the creator
    if (game.creatorEmail !== user.email) {
      res
        .status(403)
        .json({ error: "Only the game creator can delete this game" });
      return;
    }

    // Delete the game
    const { error: deleteError } = await supabaseAdmin
      .from("games")
      .delete()
      .eq("id", gameId);

    if (deleteError) {
      console.error("Error deleting game:", deleteError);
      res.status(500).json({ error: "Failed to delete game" });
      return;
    }

    res.json({ success: true, message: "Game deleted successfully" });
  } catch (err) {
    console.error("Error deleting game:", err);
    res.status(500).json({ error: "Failed to delete game" });
  }
});

export default gameRouter;
