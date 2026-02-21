import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";
import { rowToGame, gameToRow } from "@shared/game/converters.ts";
import type { Game, GameRow } from "@shared/game/types.ts";
import type { GameAction } from "@shared/actions/index.ts";
import { processAction } from "@shared/game/actions.ts";
import { GameEngine } from "@shared/game/engine.ts";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse !== null) return corsResponse;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const user = await getUserFromRequest(request);
  if (user === null) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const gameId = body.gameId;
  const action: GameAction = body.action;

  if (gameId === undefined || typeof gameId !== "string") {
    return new Response(JSON.stringify({ error: "gameId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === undefined || action.type === undefined || action.player === undefined) {
    return new Response(
      JSON.stringify({ error: "Invalid action: missing type or player" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createAdminClient();
  const { data: gameRow, error: fetchError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (fetchError !== null || gameRow === null) {
    return new Response(JSON.stringify({ error: "Game not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const game = rowToGame(gameRow as GameRow);

  // Verify user is authorized to play as the claimed player
  const playerEmail =
    action.player === "day" ? game.dayPlayerEmail : game.nightPlayerEmail;
  if (playerEmail !== user.email) {
    return new Response(
      JSON.stringify({
        error: `You are not authorized to play as ${action.player}`,
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (game.gameOver === true) {
    return new Response(
      JSON.stringify({ error: "Game is over", winner: game.winner }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { result, updatedGame } = processAction({ game, action });

  if (result.success) {
    const now = new Date();

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

    if (action.player === "day") {
      updateFields.dayPlayerLastMove = now;
    } else if (action.player === "night") {
      updateFields.nightPlayerLastMove = now;
    }

    const { error: updateError } = await supabase
      .from("games")
      .update(gameToRow(updateFields))
      .eq("id", gameId);

    if (updateError !== null) {
      console.error("Error updating game:", updateError);
    }
  }

  // Return filtered game state for the player who made the action
  const engine = new GameEngine(updatedGame);
  const filteredGame = engine.getFilteredGameState(action.player);

  return new Response(
    JSON.stringify({
      result,
      game: {
        ...filteredGame,
        id: filteredGame.id,
        viewingAs: action.player,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
