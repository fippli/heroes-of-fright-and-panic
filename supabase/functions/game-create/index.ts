import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createAdminClient,
  getUserFromRequest,
} from "../_shared/supabase-client.ts";
import { GameMap } from "@shared/map/map";
import { Piece } from "@shared/piece";
import { Player } from "@shared/player";
import type { Tile } from "@shared/map/tile";
import { ResourceMap } from "@shared/player/resource-map";

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
  const boardSize = body.size ?? 15;
  const name = body.name ?? `Game ${new Date().toISOString()}`;
  const alliance = body.alliance ?? "day";
  const inviteEmail = body.inviteEmail ?? null;

  const dayPlayer = new Player({
    type: "day",
    resources: new ResourceMap({ wood: 5, stone: 2 }),
  });
  const nightPlayer = new Player({
    type: "night",
    resources: new ResourceMap({ wood: 5, stone: 2 }),
  });

  const generatedTiles = GameMap.generate(boardSize) as Tile[];

  const grassTiles = generatedTiles.filter(
    (tile) => tile.landscape?.type === "grass",
  );

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

  const nightStartTile = grassTiles.reduce((closest, tile) => {
    const distance = Math.sqrt(
      Math.pow(tile.row, 2) + Math.pow(maxCol - tile.column, 2),
    );
    const closestDistance = Math.sqrt(
      Math.pow(closest.row, 2) + Math.pow(maxCol - closest.column, 2),
    );
    return distance < closestDistance ? tile : closest;
  }, grassTiles.at(0)!);

  const tilesWithDayPlayer = GameMap.replaceTile(
    {
      row: dayStartTile.row,
      column: dayStartTile.column,
      piece: Piece.peasant(dayPlayer),
    },
    generatedTiles,
  ) as Tile[];

  const tiles = GameMap.replaceTile(
    {
      row: nightStartTile.row,
      column: nightStartTile.column,
      piece: Piece.peasant(nightPlayer),
    },
    tilesWithDayPlayer,
  ) as Tile[];

  const dayPlayerEmail =
    alliance === "day" ? user.email : inviteEmail ?? null;
  const nightPlayerEmail =
    alliance === "night" ? user.email : inviteEmail ?? null;

  const supabase = createAdminClient();
  const { data: newGame, error } = await supabase
    .from("games")
    .insert({
      name,
      size: boardSize,
      tiles,
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

  if (error !== null || newGame === null) {
    console.error("Error creating game:", error);
    return new Response(JSON.stringify({ error: "Failed to create game" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
});
