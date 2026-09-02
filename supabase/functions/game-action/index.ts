import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";
import { appendGameEvents, recordError, type NewGameEvent } from "../_shared/events.ts";
import { rowToGame, gameToRow } from "@shared/game/converters.ts";
import type { Game, GameRow } from "@shared/game/types.ts";
import type { GameAction } from "@shared/actions/index.ts";
import { processAction } from "@shared/game/actions.ts";
import { getFilteredGameState } from "@shared/game/engine.ts";
import { inBackground, isAiTurn, runAiPhase } from "../_shared/ai-turn.ts";
import { broadcastGameUpdate } from "../_shared/notify.ts";
import { engineVersion } from "@shared/version.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type RequestContext = { gameId: string | null; action: GameAction | null };

const handle = async (request: Request, ctx: RequestContext): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const user = await getUserFromRequest(request);
  if (user === null) {
    return json({ error: "Authentication required" }, 401);
  }

  const body = await request.json();
  const gameId = body.gameId;
  const action: GameAction = body.action;

  if (gameId === undefined || typeof gameId !== "string") {
    return json({ error: "gameId is required" }, 400);
  }
  ctx.gameId = gameId;

  if (action === undefined || action.type === undefined || action.player === undefined) {
    return json({ error: "Invalid action: missing type or player" }, 400);
  }
  ctx.action = action;

  const supabase = createAdminClient();
  const { data: gameRow, error: fetchError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (fetchError !== null || gameRow === null) {
    return json({ error: "Game not found" }, 404);
  }

  const game = rowToGame(gameRow as GameRow);

  // Verify user is authorized to play as the claimed player
  const playerEmail =
    action.player === "day" ? game.dayPlayerEmail : game.nightPlayerEmail;
  if (playerEmail !== user.email) {
    return json({ error: `You are not authorized to play as ${action.player}` }, 403);
  }

  if (game.gameOver === true) {
    return json({ error: "Game is over", winner: game.winner }, 400);
  }

  const { result, updatedGame } = processAction({ game, action });
  const events: NewGameEvent[] = [
    { kind: "action", player: action.player, action, result, state: null },
  ];

  // Carry the persisted updated_at in the response so clients can tell
  // fresh snapshots from ones they already have (game-state's `since`).
  let finalGame = updatedGame;

  if (result.success) {
    const now = new Date();
    finalGame = { ...updatedGame, updatedAt: now };

    const updateFields: Partial<Game> = {
      tiles: finalGame.tiles,
      dayPlayer: finalGame.dayPlayer,
      nightPlayer: finalGame.nightPlayer,
      currentPlayer: finalGame.currentPlayer,
      clock: finalGame.clock,
      updatedAt: now,
      gameOver: finalGame.gameOver ?? false,
      winner: finalGame.winner ?? null,
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

  // Everything that doesn't shape the response runs after it is sent: the
  // event log, the realtime poke to the opponent, and the AI's phase (whose
  // result the poke/polling of game-state picks up).
  const scheduled = inBackground(async () => {
    await appendGameEvents(supabase, gameId, events);
    if (result.success) {
      await broadcastGameUpdate(gameId, finalGame.updatedAt);
      if (isAiTurn(finalGame)) {
        await runAiPhase(supabase, finalGame);
      }
    }
  });
  if (scheduled !== undefined) await scheduled;

  // Return filtered game state for the player who made the action
  const filteredGame = getFilteredGameState(finalGame, action.player);

  return json({
    result,
    engineVersion,
    game: {
      ...filteredGame,
      id: filteredGame.id,
      viewingAs: action.player,
    },
  });
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse !== null) return corsResponse;

  const ctx: RequestContext = { gameId: null, action: null };
  try {
    return await handle(request, ctx);
  } catch (caught) {
    try {
      await recordError(createAdminClient(), ctx.gameId, caught, ctx.action);
    } catch (logError) {
      console.error("Could not record error:", logError);
    }
    const message = caught instanceof Error ? caught.message : "Internal server error";
    return json({ error: message, engineVersion }, 500);
  }
});
