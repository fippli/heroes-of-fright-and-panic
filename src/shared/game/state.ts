/**
 * Game state accessors — clean API for reading and updating game state.
 */

import type { Player } from "@shared/player/index.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import type { Tile } from "@shared/map/tile.ts";
import type { Game } from "./types.ts";

/**
 * Get the player object for a given player type.
 */
export const getPlayer = (game: Game, playerType: PlayerType): Player =>
  playerType === "day" ? game.dayPlayer : game.nightPlayer;

/**
 * Return a new game with the given player updated.
 */
export const withPlayer = (
  game: Game,
  playerType: PlayerType,
  player: Player,
): Game =>
  playerType === "day"
    ? { ...game, dayPlayer: player }
    : { ...game, nightPlayer: player };

/**
 * Return a new game with the tiles replaced.
 */
export const withTiles = (
  game: Game,
  tiles: ReadonlyArray<Tile>,
): Game => ({ ...game, tiles });
