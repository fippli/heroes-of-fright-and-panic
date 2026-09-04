import { describe, expect, it } from "vitest";
import { createKing, createPeasant, type Piece } from "../piece/index.ts";
import { createCastleBuilding } from "../building/index.ts";
import { createHorse, createSteed, SteedType } from "../steed/index.ts";
import { grass, sand, water } from "../map/landscape.ts";
import type { Steed } from "../steed/index.ts";
import type { Tile } from "../map/tile.ts";
import { createPlayer } from "../player/index.ts";
import type { Game } from "../game/types.ts";
import { handleMove, handleAttack } from "../game/engine.ts";
import { validateMove } from "./index.ts";

const tile = (
  row: number,
  column: number,
  piece: Piece | null = null,
  steed: Steed | null = null,
  building: Tile["building"] = null,
): Tile => ({
  row,
  column,
  landscape: grass(),
  piece,
  building,
  steed,
});

/** Both kingdoms' king-in-castle tiles, so no action trips the win conditions */
const kingdoms = (): ReadonlyArray<Tile> => [
  tile(5, 0, createKing("day"), null, createCastleBuilding("day")),
  tile(5, 5, createKing("night"), null, createCastleBuilding("night")),
];

const gameOf = (tiles: ReadonlyArray<Tile>): Game => ({
  id: "g-1",
  createdAt: new Date("2026-09-02T10:00:00Z"),
  updatedAt: new Date("2026-09-02T10:00:00Z"),
  size: 4,
  tiles,
  dayPlayer: createPlayer({ type: "day" }),
  nightPlayer: createPlayer({ type: "night" }),
  currentPlayer: "day",
  clock: { time: 8, hasDawned: true, hasDusked: false },
  creatorEmail: "creator@example.com",
  gameOver: false,
});

const pieceAt = (game: Game, row: number, column: number): Piece | null =>
  game.tiles.find((candidate) => candidate.row === row && candidate.column === column)?.piece ?? null;

describe("validateMove with a steed", () => {
  it("lets a peasant on a horse move two steps", () => {
    const mounted: Piece = { ...createPeasant("day"), steed: createHorse() };
    const tiles = [tile(0, 0, mounted), tile(0, 1), tile(0, 2), tile(0, 3)];
    expect(validateMove(tiles, { row: 0, column: 0 }, { row: 0, column: 2 }, "day")).toEqual({ valid: true });
    expect(
      validateMove(tiles, { row: 0, column: 0 }, { row: 0, column: 3 }, "day").valid,
    ).toBe(false);
  });

  it("keeps a peasant on foot at one step", () => {
    const tiles = [tile(0, 0, createPeasant("day")), tile(0, 1), tile(0, 2)];
    expect(validateMove(tiles, { row: 0, column: 0 }, { row: 0, column: 1 }, "day")).toEqual({ valid: true });
    expect(
      validateMove(tiles, { row: 0, column: 0 }, { row: 0, column: 2 }, "day").valid,
    ).toBe(false);
  });
});

describe("movement split across a phase", () => {
  const mounted: Piece = { ...createPeasant("day"), steed: createHorse() };

  it("lets a mounted peasant take its two steps one at a time", () => {
    const start = gameOf([tile(0, 0, mounted), tile(0, 1), tile(0, 2), tile(0, 3)]);

    const first = handleMove(start, { type: "move", player: "day", from: { row: 0, column: 0 }, to: { row: 0, column: 1 } });
    expect(first.result.success).toBe(true);
    expect(pieceAt(first.game, 0, 1)?.acted).toBe(false);

    const second = handleMove(first.game, { type: "move", player: "day", from: { row: 0, column: 1 }, to: { row: 0, column: 2 } });
    expect(second.result.success).toBe(true);
    expect(pieceAt(second.game, 0, 2)?.acted).toBe(true);

    const third = handleMove(second.game, { type: "move", player: "day", from: { row: 0, column: 2 }, to: { row: 0, column: 3 } });
    expect(third.result.success).toBe(false);
  });

  it("mounting a horse on arrival leaves a step to ride on", () => {
    const start = gameOf([
      tile(0, 0, createPeasant("day")),
      tile(0, 1, null, createSteed(SteedType.horse)),
      tile(0, 2),
    ]);

    const mount = handleMove(start, { type: "move", player: "day", from: { row: 0, column: 0 }, to: { row: 0, column: 1 } });
    expect(mount.result.success).toBe(true);
    expect(pieceAt(mount.game, 0, 1)?.steed?.type).toBe(SteedType.horse);
    expect(pieceAt(mount.game, 0, 1)?.acted).toBe(false);

    const ride = handleMove(mount.game, { type: "move", player: "day", from: { row: 0, column: 1 }, to: { row: 0, column: 2 } });
    expect(ride.result.success).toBe(true);
    expect(pieceAt(ride.game, 0, 2)?.acted).toBe(true);
  });

  it("a piece that moved cannot also attack, and vice versa", () => {
    const enemy: Piece = { ...createPeasant("night"), hearts: 5, maxHearts: 5 };
    const start = gameOf([tile(0, 0, mounted), tile(0, 1), tile(0, 2, enemy), ...kingdoms()]);

    const step = handleMove(start, { type: "move", player: "day", from: { row: 0, column: 0 }, to: { row: 0, column: 1 } });
    expect(step.result.success).toBe(true);
    const afterMoveAttack = handleAttack(step.game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 0, column: 1 },
      targetPosition: { row: 0, column: 2 },
    });
    expect(afterMoveAttack.result.success).toBe(false);

    // Attack first (from adjacent), then try to move away
    const adjacent = gameOf([tile(0, 0), tile(0, 1, mounted), tile(0, 2, enemy), ...kingdoms()]);
    const attack = handleAttack(adjacent, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 0, column: 1 },
      targetPosition: { row: 0, column: 2 },
    });
    expect(attack.result.success).toBe(true);
    const moveAfterAttack = handleMove(attack.game, { type: "move", player: "day", from: { row: 0, column: 1 }, to: { row: 0, column: 0 } });
    expect(moveAfterAttack.result.success).toBe(false);
  });

  it("a piece cannot attack twice in a phase", () => {
    const attacker: Piece = { ...createPeasant("day"), baseAttack: 1 };
    const enemy: Piece = { ...createPeasant("night"), hearts: 5, maxHearts: 5 };
    const start = gameOf([tile(0, 0, attacker), tile(0, 1, enemy), ...kingdoms()]);

    const first = handleAttack(start, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 0, column: 0 },
      targetPosition: { row: 0, column: 1 },
    });
    expect(first.result.success).toBe(true);

    const second = handleAttack(first.game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 0, column: 0 },
      targetPosition: { row: 0, column: 1 },
    });
    expect(second.result.success).toBe(false);
    expect(second.result.error).toContain("already acted");
  });
});

describe("boats", () => {
  it("a peasant boards a waiting boat and sails on across the water", () => {
    const start = gameOf([
      { ...tile(0, 0, createPeasant("day")), landscape: sand() },
      { ...tile(0, 1), landscape: water(), steed: createSteed(SteedType.boat) },
      { ...tile(0, 2), landscape: water() },
      { ...tile(0, 3), landscape: sand() },
      ...kingdoms(),
    ]);

    // Board the boat: the water tile is enterable because a boat waits there
    const boarded = handleMove(start, { type: "move", player: "day", from: { row: 0, column: 0 }, to: { row: 0, column: 1 } });
    expect(boarded.result.success).toBe(true);
    expect(pieceAt(boarded.game, 0, 1)?.steed?.type).toBe(SteedType.boat);

    // The boat's move bonus applies on arrival: one step of sailing remains
    const sailed = handleMove(boarded.game, { type: "move", player: "day", from: { row: 0, column: 1 }, to: { row: 0, column: 2 } });
    expect(sailed.result.success).toBe(true);
    expect(pieceAt(sailed.game, 0, 2)?.steed?.type).toBe(SteedType.boat);
  });

  it("water without a boat stays impassable", () => {
    const start = gameOf([
      { ...tile(0, 0, createPeasant("day")), landscape: sand() },
      { ...tile(0, 1), landscape: water() },
      ...kingdoms(),
    ]);
    const swim = handleMove(start, { type: "move", player: "day", from: { row: 0, column: 0 }, to: { row: 0, column: 1 } });
    expect(swim.result.success).toBe(false);
  });
});
