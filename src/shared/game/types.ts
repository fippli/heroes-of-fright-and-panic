import type { Tile } from "../map/tile.ts";
import type { Player } from "../player/index.ts";
import type { PlayerType } from "../piece/index.ts";
import type { MapConfig } from "../map/map.ts";

export type GameClock = {
  readonly time: number; // Hour of day (0-23), advances with actions
  readonly hasDawned: boolean;
  readonly hasDusked: boolean;
};

// Database row type (snake_case as stored in PostgreSQL)
export type GameRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string | null;
  size: number;
  tiles: Tile[];
  day_player: Player;
  night_player: Player;
  current_player: PlayerType;
  clock: GameClock;
  creator_email: string;
  day_player_email: string | null;
  night_player_email: string | null;
  day_player_last_move: string | null;
  night_player_last_move: string | null;
  invited_email: string | null;
  game_over: boolean;
  winner: PlayerType | null;
  theme_id: string | null;
};

// Application type (camelCase for use in TypeScript code)
export type Game = {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name?: string;
  readonly size: number;
  readonly tiles: ReadonlyArray<Tile>;
  readonly dayPlayer: Player;
  readonly nightPlayer: Player;
  readonly currentPlayer: PlayerType;
  readonly clock: GameClock;
  readonly creatorEmail: string;
  readonly dayPlayerEmail?: string | null;
  readonly nightPlayerEmail?: string | null;
  readonly dayPlayerLastMove?: Date | null;
  readonly nightPlayerLastMove?: Date | null;
  readonly invitedEmail?: string | null;
  readonly gameOver: boolean;
  readonly winner?: PlayerType | null;
  readonly themeId?: string | null;
  readonly mapConfig?: MapConfig | null;
};
