import type { Tile } from "../map/tile.ts";
import { Player } from "../player/index.ts";
import { ResourceMap } from "../player/resource-map.ts";
import { Research } from "../research/index.ts";
import type { Game, GameRow } from "./types.ts";

// Convert database row to application type
export const rowToGame = (row: GameRow): Game => {
  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    name: row.name ?? undefined,
    size: row.size,
    tiles: row.tiles,
    dayPlayer: new Player({
      type: row.day_player.type,
      resources: new ResourceMap(row.day_player.resources),
      research: new Research(row.day_player.research ?? {}),
    }),
    nightPlayer: new Player({
      type: row.night_player.type,
      resources: new ResourceMap(row.night_player.resources),
      research: new Research(row.night_player.research ?? {}),
    }),
    currentPlayer: row.current_player,
    clock: row.clock,
    creatorEmail: row.creator_email,
    dayPlayerEmail: row.day_player_email,
    nightPlayerEmail: row.night_player_email,
    dayPlayerLastMove:
      row.day_player_last_move !== null
        ? new Date(row.day_player_last_move)
        : null,
    nightPlayerLastMove:
      row.night_player_last_move !== null
        ? new Date(row.night_player_last_move)
        : null,
    invitedEmail: row.invited_email,
    gameOver: row.game_over,
    winner: row.winner,
    themeId: row.theme_id,
  };
};

// Convert application type to database row for inserts/updates
export const gameToRow = (
  game: Partial<Game>,
): Partial<Omit<GameRow, "id" | "created_at">> => {
  const row: Partial<Omit<GameRow, "id" | "created_at">> = {};

  if (game.updatedAt !== undefined)
    row.updated_at = game.updatedAt.toISOString();
  if (game.name !== undefined) row.name = game.name ?? null;
  if (game.size !== undefined) row.size = game.size;
  if (game.tiles !== undefined) row.tiles = game.tiles as Tile[];
  if (game.dayPlayer !== undefined) row.day_player = game.dayPlayer;
  if (game.nightPlayer !== undefined) row.night_player = game.nightPlayer;
  if (game.currentPlayer !== undefined)
    row.current_player = game.currentPlayer;
  if (game.clock !== undefined) row.clock = game.clock;
  if (game.creatorEmail !== undefined) row.creator_email = game.creatorEmail;
  if (game.dayPlayerEmail !== undefined)
    row.day_player_email = game.dayPlayerEmail ?? null;
  if (game.nightPlayerEmail !== undefined)
    row.night_player_email = game.nightPlayerEmail ?? null;
  if (game.dayPlayerLastMove !== undefined)
    row.day_player_last_move = game.dayPlayerLastMove?.toISOString() ?? null;
  if (game.nightPlayerLastMove !== undefined)
    row.night_player_last_move =
      game.nightPlayerLastMove?.toISOString() ?? null;
  if (game.invitedEmail !== undefined)
    row.invited_email = game.invitedEmail ?? null;
  if (game.gameOver !== undefined) row.game_over = game.gameOver ?? false;
  if (game.winner !== undefined) row.winner = game.winner ?? null;
  if (game.themeId !== undefined) row.theme_id = game.themeId ?? null;

  return row;
};
