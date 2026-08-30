import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";
import { rowToGame } from "@shared/game/converters.ts";
import type { GameRow } from "@shared/game/types.ts";
import type { PlayerType } from "@shared/actions/index.ts";
import { getFilteredGameState, getSpectatorGameState } from "@shared/game/engine.ts";
import { isAiTurn, runAiPhase } from "../_shared/ai-turn.ts";

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

  const stored = rowToGame(gameRow as GameRow);

  // A stalled AI phase (older than the background runner should need) is
  // resumed here, so a game can never sit on the AI's turn forever.
  const STALL_AFTER_MS = 15_000;
  const game =
    isAiTurn(stored) && Date.now() - stored.updatedAt.getTime() > STALL_AFTER_MS
      ? await runAiPhase(supabase, stored)
      : stored;

  // Derive player perspective from JWT email
  const playerType: PlayerType | null =
    game.dayPlayerEmail === user.email
      ? "day"
      : game.nightPlayerEmail === user.email
        ? "night"
        : null;

  const dayOpen = game.dayPlayerEmail === null || game.dayPlayerEmail === undefined;
  const nightOpen = game.nightPlayerEmail === null || game.nightPlayerEmail === undefined;

  if (playerType !== null) {
    const filteredGame = getFilteredGameState(game, playerType);
    const opponentOpen = playerType === "day" ? nightOpen : dayOpen;

    return new Response(
      JSON.stringify({
        ...filteredGame,
        id: filteredGame.id,
        viewingAs: playerType,
        opponentOpen,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Not a participant. If a seat is free, offer it instead of the board.
  const canJoin: PlayerType | null = dayOpen ? "day" : nightOpen ? "night" : null;
  if (canJoin !== null) {
    return new Response(
      JSON.stringify({ id: game.id, name: game.name ?? null, size: game.size, viewingAs: null, canJoin }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Spectator: only what either side can see
  const spectatorGame = getSpectatorGameState(game);
  return new Response(
    JSON.stringify({
      ...spectatorGame,
      id: game.id,
      viewingAs: null,
      canJoin: null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
