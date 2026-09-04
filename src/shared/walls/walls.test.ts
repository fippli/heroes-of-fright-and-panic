import { describe, expect, it } from "vitest";
import { planTowerWalls } from "./index.ts";
import { handleBuild } from "../game/engine.ts";
import { BuildingType, createTowerBuilding } from "../building/index.ts";
import { createPeasant, type Piece } from "../piece/index.ts";
import { grass, mountain, water } from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import { createPlayer } from "../player/index.ts";
import { createResourceMap } from "../player/resource-map.ts";
import type { Game } from "../game/types.ts";

const tile = (
  row: number,
  column: number,
  overrides: Partial<Tile> = {},
): Tile => ({
  row,
  column,
  landscape: grass(),
  piece: null,
  building: null,
  steed: null,
  ...overrides,
});

const gameOf = (tiles: ReadonlyArray<Tile>): Game => ({
  id: "g-1",
  createdAt: new Date("2026-09-04T10:00:00Z"),
  updatedAt: new Date("2026-09-04T10:00:00Z"),
  size: 8,
  tiles,
  dayPlayer: createPlayer({ type: "day", resources: createResourceMap({ stone: 8 }) }),
  nightPlayer: createPlayer({ type: "night" }),
  currentPlayer: "day",
  clock: { time: 8, hasDawned: true, hasDusked: false },
  creatorEmail: "creator@example.com",
  gameOver: false,
});

describe("planTowerWalls", () => {
  it("walls the open tiles between the new tower and an existing one", () => {
    const tiles = [
      tile(0, 0, { building: createTowerBuilding("day") }),
      tile(0, 1),
      tile(0, 2),
      tile(0, 3),
    ];
    const plan = planTowerWalls(tiles, { row: 0, column: 3 }, "day");
    expect(plan.linkedTowers).toEqual([{ row: 0, column: 0 }]);
    expect(plan.newWallCount).toBe(2);
    const at = (column: number) => plan.walls.find((wall) => wall.position.column === column);
    expect(at(1)?.edges).toEqual([0, 3]); // E and W: a straight run
    expect(at(2)?.edges).toEqual([0, 3]);
  });

  it("uses mountains as free wall and skips them", () => {
    const tiles = [
      tile(0, 0, { building: createTowerBuilding("day") }),
      tile(0, 1),
      tile(0, 2, { landscape: mountain() }),
      tile(0, 3),
    ];
    const plan = planTowerWalls(tiles, { row: 0, column: 3 }, "day");
    expect(plan.linkedTowers).toHaveLength(1);
    expect(plan.newWallCount).toBe(1);
    expect(plan.walls.map((wall) => wall.position.column)).toEqual([1]);
  });

  it("links nothing when no friendly tower is in range", () => {
    const tiles = [tile(0, 0), tile(0, 1), tile(0, 2)];
    const plan = planTowerWalls(tiles, { row: 0, column: 0 }, "day");
    expect(plan.linkedTowers).toHaveLength(0);
    expect(plan.newWallCount).toBe(0);
  });

  it("routes around water it cannot pass but counts it as barrier on the line", () => {
    // Direct line blocked by an enemy building forces a detour or no link
    const tiles = [
      tile(0, 0, { building: createTowerBuilding("day") }),
      tile(0, 1, { landscape: water() }),
      tile(0, 2),
    ];
    const plan = planTowerWalls(tiles, { row: 0, column: 2 }, "day");
    // Water is traversable barrier: link succeeds with zero new walls
    expect(plan.linkedTowers).toHaveLength(1);
    expect(plan.newWallCount).toBe(0);
  });
});

describe("handleBuild with curtain walls", () => {
  const watcher: Piece = createPeasant("day");

  it("charges for and raises the wall when a tower is placed", () => {
    const start = gameOf([
      tile(0, 0, { building: createTowerBuilding("day") }),
      tile(0, 1),
      tile(0, 2),
      tile(0, 3, { piece: watcher }),
      tile(0, 4),
    ]);
    const built = handleBuild(start, { type: "build", player: "day", buildingType: BuildingType.tower, position: { row: 0, column: 3 } });
    expect(built.result.success).toBe(true);

    const wallAt = (column: number) =>
      built.game.tiles.find((candidate) => candidate.row === 0 && candidate.column === column)?.building;
    expect(wallAt(1)?.type).toBe(BuildingType.wall);
    expect(wallAt(2)?.type).toBe(BuildingType.wall);
    expect(wallAt(1)?.connections).toEqual([0, 3]);
    // Tower 5 stone + 2 wall segments of stone
    expect(built.game.dayPlayer.resources.stone).toBe(1);
  });

  it("refuses the tower when the wall cannot be afforded", () => {
    const start = gameOf([
      tile(0, 0, { building: createTowerBuilding("day") }),
      tile(0, 1),
      tile(0, 2),
      tile(0, 3, { piece: watcher }),
    ]);
    const broke: Game = {
      ...start,
      dayPlayer: { ...start.dayPlayer, resources: createResourceMap({ stone: 5 }) },
    };
    const built = handleBuild(broke, { type: "build", player: "day", buildingType: BuildingType.tower, position: { row: 0, column: 3 } });
    expect(built.result.success).toBe(false);
    expect(built.result.error).toContain("wall segments");
  });
});
