/**
 * game-debug — open, read-only inspection of game state for development.
 *
 * No authentication. All personal data (emails) is stripped; seats are
 * reported as "human" / "ai" / "open". Every response carries the
 * engineVersion the function was deployed from.
 *
 *   GET  ?action=list[&limit=10]
 *   GET  ?action=get&gameId=<id>[&as=day|night]
 *   GET  ?action=events&gameId=<id>        every recorded event (no snapshots)
 *   GET  ?action=replay&gameId=<id>        re-run the log and diff against stored state
 *   GET  ?action=errors[&gameId=<id>]      recent browser-reported errors
 *   POST { "action": "list" | "get", "gameId"?, "as"?, "limit"? }
 *
 * `as` returns the state after fog-of-war filtering, i.e. exactly what that
 * player's client receives. Without it the raw stored state is returned.
 */
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-client.ts";
import { rowToGame } from "@shared/game/converters.ts";
import type { GameRow } from "@shared/game/types.ts";
import { getFilteredGameState } from "@shared/game/engine.ts";
import { redactGame, summarizeGame } from "@shared/game/debug.ts";
import { engineVersion } from "@shared/version.ts";
import { diffGames, replayEvents, type GameEvent } from "@shared/game/events.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Params = {
  action: string | null;
  gameId: string | null;
  as: string | null;
  limit: number;
};

const readParams = async (request: Request): Promise<Params> => {
  const url = new URL(request.url);
  const query = url.searchParams;
  const body: Record<string, unknown> =
    request.method === "POST"
      ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
      : {};
  const pick = (key: string): string | null => {
    const fromBody = body[key];
    if (typeof fromBody === "string") return fromBody;
    if (typeof fromBody === "number") return String(fromBody);
    return query.get(key);
  };
  const limitRaw = Number(pick("limit") ?? 10);
  return {
    action: pick("action"),
    gameId: pick("gameId"),
    as: pick("as"),
    limit: Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10,
  };
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse !== null) return corsResponse;

  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const params = await readParams(request);
  const supabase = createAdminClient();

  if (params.action === "list") {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(params.limit);
    if (error !== null || data === null) {
      return json({ error: error?.message ?? "Failed to list games" }, 500);
    }
    const games = (data as GameRow[]).map((row) => summarizeGame(rowToGame(row)));
    return json({ engineVersion, games });
  }

  if (params.action === "get") {
    if (params.gameId === null) {
      return json({ error: "gameId is required" }, 400);
    }
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", params.gameId)
      .single();
    if (error !== null || data === null) {
      return json({ error: "Game not found" }, 404);
    }
    const game = rowToGame(data as GameRow);

    if (params.as !== null && params.as !== "day" && params.as !== "night") {
      return json({ error: "as must be 'day' or 'night'" }, 400);
    }
    const view = params.as === null ? game : getFilteredGameState(game, params.as);
    const visibleTiles = view.tiles.filter(
      (tile) => tile.landscape?.type !== "unexplored",
    ).length;

    return json({
      engineVersion,
      as: params.as ?? "raw",
      summary: { ...summarizeGame(view), visibleTiles },
      game: redactGame(view),
    });
  }

  if (params.action === "events" || params.action === "replay") {
    if (params.gameId === null) {
      return json({ error: "gameId is required" }, 400);
    }
    const { data, error } = await supabase
      .from("game_events")
      .select("seq, kind, player, action, result, state, engine_version, created_at")
      .eq("game_id", params.gameId)
      .order("seq", { ascending: true });
    if (error !== null || data === null) {
      return json({ error: error?.message ?? "Failed to load events" }, 500);
    }
    const events: GameEvent[] = data.map((row) => ({
      seq: row.seq as number,
      kind: row.kind as GameEvent["kind"],
      player: (row.player as GameEvent["player"]) ?? null,
      action: (row.action as GameEvent["action"]) ?? null,
      result: (row.result as GameEvent["result"]) ?? null,
      state: (row.state as GameEvent["state"]) ?? null,
      engineVersion: (row.engine_version as string | null) ?? null,
      createdAt: row.created_at as string,
    }));

    if (params.action === "events") {
      return json({
        engineVersion,
        events: events.map((event) => ({
          ...event,
          // Snapshots are large and carry emails; the replay action uses them
          state: event.kind === "error" ? event.state : event.state !== null ? "(snapshot)" : null,
        })),
      });
    }

    const report = replayEvents(events);
    const { data: row } = await supabase.from("games").select("*").eq("id", params.gameId).single();
    const stored = row !== null ? rowToGame(row as GameRow) : null;
    return json({
      engineVersion,
      applied: report.applied,
      error: report.error,
      divergence: report.divergence,
      diffAgainstStored:
        report.game !== null && stored !== null ? diffGames(report.game, stored) : null,
      replayed: report.game !== null ? { clock: report.game.clock, currentPlayer: report.game.currentPlayer, summary: summarizeGame(report.game) } : null,
      stored: stored !== null ? { clock: stored.clock, currentPlayer: stored.currentPlayer } : null,
    });
  }

  if (params.action === "errors") {
    let query = supabase
      .from("client_errors")
      .select("id, game_id, player, message, stack, context, user_agent, app_version, created_at")
      .order("created_at", { ascending: false })
      .limit(params.limit);
    if (params.gameId !== null) query = query.eq("game_id", params.gameId);
    const { data, error } = await query;
    if (error !== null) return json({ error: error.message }, 500);
    return json({ engineVersion, errors: data });
  }

  return json(
    {
      engineVersion,
      error: "Unknown action",
      usage: [
        "?action=list&limit=10",
        "?action=get&gameId=<id>",
        "?action=get&gameId=<id>&as=day|night",
        "?action=events&gameId=<id>",
        "?action=replay&gameId=<id>",
        "?action=errors[&gameId=<id>]",
      ],
    },
    400,
  );
});
