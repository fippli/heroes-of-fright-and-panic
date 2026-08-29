/**
 * game-debug — open, read-only inspection of game state for development.
 *
 * No authentication. All personal data (emails) is stripped; seats are
 * reported as "human" / "ai" / "open". Every response carries the
 * engineVersion the function was deployed from.
 *
 *   GET  ?action=list[&limit=10]
 *   GET  ?action=get&gameId=<id>[&as=day|night]
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

  return json(
    {
      engineVersion,
      error: "Unknown action",
      usage: [
        "?action=list&limit=10",
        "?action=get&gameId=<id>",
        "?action=get&gameId=<id>&as=day|night",
      ],
    },
    400,
  );
});
