import { describe, expect, it } from "vitest";
import { createGame } from "./create-game.ts";
import { processAction } from "./actions.ts";
import {
  getFilteredGameState,
  getVisibleTiles,
  rememberVisible,
} from "./engine.ts";
import { LandscapeType } from "../map/landscape.ts";
import { createPeasant } from "../piece/index.ts";
import type { Game } from "./types.ts";
import type { Tile } from "../map/tile.ts";

const game: Game = {
  ...createGame({
    boardSize: 12,
    name: "memory test",
    alliance: "day",
    creatorEmail: "creator@example.com",
    inviteEmail: "other@example.com",
    seed: 7,
  }),
  id: "g-1",
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-02T10:00:00Z"),
  gameOver: false,
};

const keyOf = (tile: Tile): string => `${tile.row},${tile.column}`;

/** The game with day's memory populated, then every day piece removed */
const blindedDay = (): { blind: Game; wasVisible: Set<string> } => {
  const remembered = rememberVisible(game);
  const wasVisible = getVisibleTiles(remembered, "day");
  const blind: Game = {
    ...remembered,
    tiles: remembered.tiles.map((tile) =>
      tile.piece !== null && tile.piece.owner === "day"
        ? { ...tile, piece: null }
        : tile,
    ),
  };
  return { blind, wasVisible };
};

describe("rememberVisible", () => {
  it("records a snapshot of every tile in each player's vision", () => {
    const remembered = rememberVisible(game);
    const visible = getVisibleTiles(remembered, "day");
    const memory = remembered.dayPlayer.explored ?? {};
    expect(Object.keys(memory).length).toBe(visible.size);
    visible.forEach((key) => expect(memory[key]).toBeDefined());
  });

  it("runs as part of every successful action", () => {
    const { result, updatedGame } = processAction({
      game,
      action: { type: "pass", player: "day", toPhaseEnd: false },
    });
    expect(result.success).toBe(true);
    expect(updatedGame.dayPlayer.explored).toBeDefined();
    expect(updatedGame.nightPlayer.explored).toBeDefined();
  });
});

describe("getFilteredGameState with memory", () => {
  it("serves remembered terrain and buildings for tiles that left vision", () => {
    const { blind, wasVisible } = blindedDay();
    const filtered = getFilteredGameState(blind, "day");

    // Day sees nothing live any more except its own buildings' tiles
    const stillVisible = getVisibleTiles(blind, "day");
    const remembered = filtered.tiles.filter(
      (tile) => wasVisible.has(keyOf(tile)) && !stillVisible.has(keyOf(tile)),
    );
    expect(remembered.length).toBeGreaterThan(0);
    remembered.forEach((tile) => {
      expect(tile.landscape?.type).not.toBe(LandscapeType.unexplored);
      expect(tile.piece).toBeNull();
    });

    // The day Keep was in day's own vision; its snapshot survives blindness
    const keep = remembered.concat(filtered.tiles.filter((tile) => stillVisible.has(keyOf(tile))))
      .find((tile) => tile.building?.owner === "day");
    expect(keep).toBeDefined();
  });

  it("hides an enemy piece standing on a remembered tile", () => {
    const { blind, wasVisible } = blindedDay();
    const stillVisible = getVisibleTiles(blind, "day");
    const targetKey = [...wasVisible].find((key) => {
      const tile = blind.tiles.find((candidate) => keyOf(candidate) === key);
      return (
        !stillVisible.has(key) &&
        tile !== undefined &&
        tile.piece === null &&
        tile.building === null
      );
    });
    expect(targetKey).toBeDefined();

    const withEnemy: Game = {
      ...blind,
      tiles: blind.tiles.map((tile) =>
        keyOf(tile) === targetKey ? { ...tile, piece: createPeasant("night") } : tile,
      ),
    };
    const filtered = getFilteredGameState(withEnemy, "day");
    const seen = filtered.tiles.find((tile) => keyOf(tile) === targetKey);
    expect(seen?.piece).toBeNull();
    expect(seen?.landscape?.type).not.toBe(LandscapeType.unexplored);
  });

  it("keeps never-seen tiles unexplored and off the wire", () => {
    const remembered = rememberVisible(game);
    const visible = getVisibleTiles(remembered, "day");
    const filtered = getFilteredGameState(remembered, "day");
    const memory = remembered.dayPlayer.explored ?? {};

    filtered.tiles
      .filter((tile) => !visible.has(keyOf(tile)) && memory[keyOf(tile)] === undefined)
      .forEach((tile) => {
        expect(tile.landscape?.type).toBe(LandscapeType.unexplored);
        expect(tile.piece).toBeNull();
        expect(tile.building).toBeNull();
        expect(tile.steed ?? null).toBeNull();
      });
  });

  it("never sends the memory map itself or the opponent's memory", () => {
    const remembered = rememberVisible(game);
    const filtered = getFilteredGameState(remembered, "day");
    expect(filtered.dayPlayer.explored).toBeUndefined();
    expect(filtered.nightPlayer.explored).toBeUndefined();
  });
});
