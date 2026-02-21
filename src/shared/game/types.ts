import type { Tile } from "../map/tile.ts";
import type { Player } from "../player/index.ts";

export type GameClock = {
  time: number; // Hour of day (0-23), advances with actions
  hasDawned: boolean;
  hasDusked: boolean;
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
  current_player: "day" | "night";
  clock: GameClock;
  creator_email: string;
  day_player_email: string | null;
  night_player_email: string | null;
  day_player_last_move: string | null;
  night_player_last_move: string | null;
  invited_email: string | null;
  game_over: boolean;
  winner: "day" | "night" | null;
};

// Application type (camelCase for use in TypeScript code)
export type Game = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name?: string;
  size: number;
  tiles: Tile[];
  dayPlayer: Player;
  nightPlayer: Player;
  currentPlayer: "day" | "night";
  clock: GameClock;
  creatorEmail: string;
  dayPlayerEmail?: string | null;
  nightPlayerEmail?: string | null;
  dayPlayerLastMove?: Date | null;
  nightPlayerLastMove?: Date | null;
  invitedEmail?: string | null;
  gameOver?: boolean;
  winner?: "day" | "night" | null;
};
