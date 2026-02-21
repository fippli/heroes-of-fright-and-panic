import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";
import { rowToGame } from "@shared/game/converters";
import type { GameRow } from "@shared/game/types";
import type { PlayerType } from "@shared/actions";
import { GameEngine } from "@shared/game/engine";

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

  if (gameId === undefined || typeof gameId !== "string") {
    return new Response(JSON.stringify({ error: "gameId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  // Derive player perspective from JWT email instead of trusting a query param
  const playerType: PlayerType | null =
    game.dayPlayerEmail === user.email
      ? "day"
      : game.nightPlayerEmail === user.email
        ? "night"
        : null;

  if (playerType !== null) {
    const engine = new GameEngine(game);
    const filteredGame = engine.getFilteredGameState(playerType);

    return new Response(
      JSON.stringify({
        ...filteredGame,
        id: filteredGame.id,
        viewingAs: playerType,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // No player match — return full state (spectator/debugging)
  return new Response(
    JSON.stringify({
      ...game,
      id: game.id,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
