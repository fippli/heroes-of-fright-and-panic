import { describe, expect, it } from "vitest";
import { endPhase, handleBuild, FARMS_PER_HOUSE } from "./engine.ts";
import { BuildingType } from "../building/index.ts";
import { createPeasant } from "../piece/index.ts";
import { grass, LandscapeType } from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import { createPlayer } from "../player/index.ts";
import { createResourceMap, type ResourceMap } from "../player/resource-map.ts";
import type { Game } from "./types.ts";

const tile = (row: number, column: number, overrides: Partial<Tile> = {}): Tile => ({
  row,
  column,
  landscape: grass(),
  piece: null,
  building: null,
  steed: null,
  ...overrides,
});

const gameOf = (tiles: ReadonlyArray<Tile>, nightResources: ResourceMap): Game => ({
  id: "g-1",
  createdAt: new Date("2026-09-04T10:00:00Z"),
  updatedAt: new Date("2026-09-04T10:00:00Z"),
  size: 8,
  tiles,
  dayPlayer: createPlayer({ type: "day", resources: createResourceMap({ wood: 5 }) }),
  nightPlayer: createPlayer({ type: "night", resources: nightResources }),
  currentPlayer: "day",
  clock: { time: 17, hasDawned: true, hasDusked: false },
  creatorEmail: "creator@example.com",
  gameOver: false,
});

describe("food upkeep", () => {
  it("each piece eats one food when its phase begins", () => {
    const game = gameOf(
      [tile(0, 0, { piece: createPeasant("night") }), tile(0, 1, { piece: createPeasant("night") })],
      createResourceMap({ food: 5 }),
    );
    const night = endPhase(game, "day");
    expect(night.nightPlayer.resources.food).toBe(3);
    // Everyone was fed: all pieces start the phase rested
    night.tiles.forEach((candidate) => {
      if (candidate.piece?.owner === "night") expect(candidate.piece.acted ?? false).toBe(false);
    });
  });

  it("unfed pieces start the phase too hungry to act", () => {
    const game = gameOf(
      [
        tile(0, 0, { piece: createPeasant("night") }),
        tile(0, 1, { piece: createPeasant("night") }),
        tile(0, 2, { piece: createPeasant("night") }),
      ],
      createResourceMap({ food: 1 }),
    );
    const night = endPhase(game, "day");
    expect(night.nightPlayer.resources.food).toBe(0);
    const pieces = night.tiles.filter((candidate) => candidate.piece?.owner === "night");
    expect(pieces.filter((candidate) => candidate.piece?.acted === true)).toHaveLength(2);
    expect(pieces.filter((candidate) => candidate.piece?.acted !== true)).toHaveLength(1);
  });
});

describe("farm cap", () => {
  it("a new house farms at most three neighboring grass tiles", () => {
    const game: Game = {
      ...gameOf(
        [
          // Center of a full grass ring
          tile(2, 2, { piece: createPeasant("day") }),
          tile(2, 3), tile(2, 1), tile(1, 2), tile(1, 1), tile(3, 2), tile(3, 1),
          tile(2, 4),
        ],
        createResourceMap(),
      ),
      currentPlayer: "day",
    };
    const built = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 3 },
    });
    expect(built.result.success).toBe(true);
    const farms = built.game.tiles.filter(
      (candidate) => candidate.landscape?.type === LandscapeType.farm,
    );
    expect(farms.length).toBeLessThanOrEqual(FARMS_PER_HOUSE);
    expect(farms.length).toBeGreaterThan(0);
  });
});
