import { describe, expect, it } from "vitest";
import { rowToGame } from "./converters.ts";
import { getFilteredGameState } from "./engine.ts";
import type { GameRow } from "./types.ts";

const legacyRow = {
  id: "legacy",
  created_at: "2026-08-28T14:39:54.789Z",
  updated_at: "2026-08-28T14:39:54.789Z",
  name: "legacy",
  size: 2,
  // Legacy tiles: no piece/building keys at all, legacy piece shape
  tiles: [
    { row: 0, column: 0, landscape: { type: "grass" } },
    { row: 0, column: 1, landscape: { type: "tree" } },
    {
      row: 1,
      column: 0,
      landscape: { type: "grass" },
      piece: { type: "peasant", owner: { type: "day" }, viewRange: 1 },
    },
    { row: 1, column: 1, landscape: { type: "grass" } },
  ],
  day_player: { type: "day", resources: { wood: 5, gold: 0, stone: 2, food: 0 } },
  night_player: { type: "night", resources: { wood: 5, gold: 0, stone: 2, food: 0 } },
  current_player: "day",
  clock: { time: 6 },
  creator_email: "a@b.c",
  day_player_email: "a@b.c",
  night_player_email: null,
  day_player_last_move: null,
  night_player_last_move: null,
  invited_email: null,
  game_over: false,
  winner: null,
  theme_id: null,
} as unknown as GameRow;

describe("rowToGame", () => {
  it("fills missing piece/building keys so the engine never sees undefined", () => {
    const game = rowToGame(legacyRow);
    game.tiles.forEach((tile) => {
      expect(tile.piece === null || typeof tile.piece === "object").toBe(true);
      expect(tile.building).toBeDefined();
    });
    expect(game.tiles[0].piece).toBeNull();
    expect(game.tiles[0].building).toBeNull();
  });

  it("lets fog-of-war filtering run on a legacy row without throwing", () => {
    const game = rowToGame(legacyRow);
    expect(() => getFilteredGameState(game, "day")).not.toThrow();
  });
});
