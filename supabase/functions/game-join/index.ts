import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";
import { rowToGame } from "@shared/game/converters.ts";
import type { GameRow } from "@shared/game/types.ts";

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

  if (game.dayPlayerEmail === user.email || game.nightPlayerEmail === user.email) {
    return new Response(JSON.stringify({ error: "You are already in this game" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dayOpen = game.dayPlayerEmail === null || game.dayPlayerEmail === undefined;
  const nightOpen = game.nightPlayerEmail === null || game.nightPlayerEmail === undefined;
  const requested: "day" | "night" | undefined =
    body.side === "day" || body.side === "night" ? body.side : undefined;
  const side = requested ?? (dayOpen ? "day" : nightOpen ? "night" : null);

  if (side === null || (side === "day" && !dayOpen) || (side === "night" && !nightOpen)) {
    return new Response(JSON.stringify({ error: "That seat is already taken" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await supabase
    .from("games")
    .update({
      [side === "day" ? "day_player_email" : "night_player_email"]: user.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  if (updateError !== null) {
    console.error("Error joining game:", updateError);
    return new Response(JSON.stringify({ error: "Failed to join game" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: true, side, message: `Joined game as ${side} player` }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
