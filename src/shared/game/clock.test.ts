import { describe, expect, it } from "vitest";
import { processAction } from "./actions.ts";
import { createKing, createPeasant } from "../piece/index.ts";
import { createCastleBuilding } from "../building/index.ts";
import { grass } from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import { createPlayer } from "../player/index.ts";
import { createResourceMap } from "../player/resource-map.ts";
import type { Game, GameClock } from "./types.ts";

const tile = (row: number, column: number, overrides: Partial<Tile> = {}): Tile => ({
  row,
  column,
  landscape: grass(),
  piece: null,
  building: null,
  steed: null,
  ...overrides,
});

const gameAt = (clock: GameClock, currentPlayer: "day" | "night" = "day"): Game => ({
  id: "g-1",
  createdAt: new Date("2026-09-04T10:00:00Z"),
  updatedAt: new Date("2026-09-04T10:00:00Z"),
  size: 8,
  tiles: [
    tile(0, 0, { piece: createPeasant(currentPlayer) }),
    tile(0, 1),
    tile(5, 0, { piece: createKing("day"), building: createCastleBuilding("day") }),
    tile(5, 5, { piece: createKing("night"), building: createCastleBuilding("night") }),
  ],
  dayPlayer: createPlayer({ type: "day", resources: createResourceMap({ wood: 5 }) }),
  nightPlayer: createPlayer({ type: "night", resources: createResourceMap({ wood: 5 }) }),
  currentPlayer,
  clock,
  creatorEmail: "creator@example.com",
  gameOver: false,
});

const move = (player: "day" | "night") =>
  ({ type: "move", player, from: { row: 0, column: 0 }, to: { row: 0, column: 1 } }) as const;

describe("the clock", () => {
  it("counts one hour for any successful action", () => {
    const { result, updatedGame } = processAction({
      game: gameAt({ time: 6, hasDawned: true, hasDusked: false }),
      action: move("day"),
    });
    expect(result.success).toBe(true);
    expect(updatedGame.clock.time).toBe(7);
  });

  it("stalls at the last hour of the phase instead of crossing dusk", () => {
    const { updatedGame } = processAction({
      game: gameAt({ time: 17, hasDawned: true, hasDusked: false }),
      action: move("day"),
    });
    expect(updatedGame.clock.time).toBe(17);
  });

  it("wraps midnight during the night phase and stalls before dawn", () => {
    const overMidnight = processAction({
      game: gameAt({ time: 23, hasDawned: true, hasDusked: true }, "night"),
      action: move("night"),
    });
    expect(overMidnight.updatedGame.clock.time).toBe(0);

    const beforeDawn = processAction({
      game: gameAt({ time: 5, hasDawned: true, hasDusked: true }, "night"),
      action: move("night"),
    });
    expect(beforeDawn.updatedGame.clock.time).toBe(5);
  });

  it("does not tick on a failed action, and pass sets the phase boundary itself", () => {
    const failed = processAction({
      game: gameAt({ time: 9, hasDawned: true, hasDusked: false }),
      action: move("night"),
    });
    expect(failed.result.success).toBe(false);
    expect(failed.updatedGame.clock.time).toBe(9);

    const passed = processAction({
      game: gameAt({ time: 11, hasDawned: true, hasDusked: false }),
      action: { type: "pass", player: "day", toPhaseEnd: true },
    });
    expect(passed.result.success).toBe(true);
    expect(passed.updatedGame.clock.time).toBe(18);
  });
});
