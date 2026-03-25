import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";
import { createGame } from "@shared/game/create-game.ts";

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

  try {
    const body = await request.json();
    const boardSize = body.size ?? 15;
    const name = body.name ?? `Game ${new Date().toISOString()}`;
    const alliance = body.alliance ?? "day";
    const inviteEmail = body.inviteEmail ?? null;
    const themeId = body.themeId ?? null;

    const gameData = createGame({
      boardSize,
      name,
      alliance,
      creatorEmail: user.email,
      inviteEmail,
    });

    const supabase = createAdminClient();
    const { data: newGame, error } = await supabase
      .from("games")
      .insert({
        name: gameData.name,
        size: gameData.size,
        tiles: gameData.tiles,
        day_player: gameData.dayPlayer,
        night_player: gameData.nightPlayer,
        current_player: gameData.currentPlayer,
        clock: gameData.clock,
        creator_email: gameData.creatorEmail,
        day_player_email: gameData.dayPlayerEmail,
        night_player_email: gameData.nightPlayerEmail,
        day_player_last_move: null,
        night_player_last_move: null,
        invited_email: gameData.invitedEmail,
        theme_id: themeId,
        game_over: gameData.gameOver,
        winner: gameData.winner,
      })
      .select()
      .single();

    if (error !== null || newGame === null) {
      console.error("Error creating game:", error);
      return new Response(
        JSON.stringify({
          error: `Failed to create game: ${error?.message ?? "unknown error"}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        id: newGame.id,
        name,
        size: boardSize,
        currentPlayer: "day",
        createdAt: newGame.created_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (caught) {
    const errorMessage =
      caught instanceof Error ? caught.message : "Internal server error";
    console.error("Unhandled error in game-create:", caught);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
