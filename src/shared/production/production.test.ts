import { describe, it, expect } from "vitest";
import { createChurchBuilding, createHouseBuilding } from "@shared/building/index.ts";
import { LandscapeType, grass, farm as farmLandscape, tree as treeLandscape, mountain as mountainLandscape, water as waterLandscape, sand as sandLandscape } from "@shared/map/landscape.ts";
import type { Tile } from "@shared/map/tile.ts";
import { createPeasant, createPriest } from "@shared/piece/index.ts";
import { createResearch } from "@shared/research/index.ts";
import { calculateProduction, countPrayingPriests } from "./index.ts";

/**
 * Helper to create a minimal tile at a given position.
 */
const makeTile = (
  row: number,
  column: number,
  overrides: Partial<Tile> = {},
): Tile => ({
  row,
  column,
  landscape: grass(),
  piece: null,
  building: null,
  ...overrides,
});

/**
 * Create a simple 3-tile horizontal row for testing neighbors.
 * Hex grid: row 0 columns 0,1,2.
 * For an even row: col 1 neighbors are col 0 and col 2 on same row.
 */
const makeHouseWithNeighbors = (
  owner: "day" | "night",
  neighborLandscapes: Array<{ type: LandscapeType }>,
): Tile[] => {
  // Center tile at (0, 1) is the house
  const houseTile = makeTile(0, 1, {
    building: createHouseBuilding(owner),
    piece: createPeasant(owner),
  });

  // Neighbors: (0,0) is west, (0,2) is east
  const tiles: Tile[] = [
    makeTile(0, 0, { landscape: neighborLandscapes.at(0) ?? grass() }),
    houseTile,
    makeTile(0, 2, { landscape: neighborLandscapes.at(1) ?? grass() }),
  ];

  return tiles;
};

describe("calculateProduction", () => {
  it("produces food from adjacent farm tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      farmLandscape(),
      farmLandscape(),
    ]);

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.food).toBe(2);
    expect(production.wood).toBe(0);
  });

  it("produces wood from adjacent tree tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      treeLandscape(),
      grass(),
    ]);

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.wood).toBe(1);
  });

  it("produces stone from adjacent mountain tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      mountainLandscape(),
      grass(),
    ]);

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.stone).toBe(1);
    expect(production.iron).toBe(0);
    expect(production.gold).toBe(0);
  });

  it("produces stone + iron from mountain with Mining II", () => {
    const tiles = makeHouseWithNeighbors("day", [
      mountainLandscape(),
      grass(),
    ]);

    const research = createResearch({ hasMiningII: true });
    const production = calculateProduction("day", tiles, research);
    expect(production.stone).toBe(1);
    expect(production.iron).toBe(1);
    expect(production.gold).toBe(0);
  });

  it("produces stone + iron + gold from mountain with Mining III", () => {
    const tiles = makeHouseWithNeighbors("day", [
      mountainLandscape(),
      grass(),
    ]);

    const research = createResearch({ hasMiningII: true, hasMiningIII: true });
    const production = calculateProduction("day", tiles, research);
    expect(production.stone).toBe(1);
    expect(production.iron).toBe(1);
    expect(production.gold).toBe(1);
  });

  it("farms and forests produce without a peasant in the house", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, { landscape: farmLandscape() }),
      makeTile(0, 1, {
        building: createHouseBuilding("day"),
        piece: null, // no peasant
      }),
      makeTile(0, 2, { landscape: treeLandscape() }),
    ];

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.food).toBe(1);
    expect(production.wood).toBe(1);
  });

  it("mountains only produce while a peasant lives in the house", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, { landscape: mountainLandscape() }),
      makeTile(0, 1, {
        building: createHouseBuilding("day"),
        piece: null, // no peasant
      }),
      makeTile(0, 2, { landscape: grass() }),
    ];

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.stone).toBe(0);
  });

  it("does not produce from enemy houses", () => {
    const tiles = makeHouseWithNeighbors("night", [
      farmLandscape(),
      farmLandscape(),
    ]);

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.food).toBe(0);
  });

  it("each terrain tile produces once regardless of adjacent house count", () => {
    // Two houses share a farm tile between them
    // House at (0,0) and house at (0,2), shared farm at (0,1)
    const sharedFarm = makeTile(0, 1, { landscape: farmLandscape() });
    const house1 = makeTile(0, 0, {
      building: createHouseBuilding("day"),
      piece: createPeasant("day"),
    });
    const house2 = makeTile(0, 2, {
      building: createHouseBuilding("day"),
      piece: createPeasant("day"),
    });

    const tiles = [house1, sharedFarm, house2];
    const production = calculateProduction("day", tiles, createResearch());
    // The farm at (0,1) should only produce once
    expect(production.food).toBe(1);
  });

  it("does not produce from water, sand, grass, or unexplored tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      waterLandscape(),
      sandLandscape(),
    ]);

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.food).toBe(0);
    expect(production.wood).toBe(0);
    expect(production.stone).toBe(0);
  });
});

describe("calculateChurchProduction", () => {
  it("produces faith from church with praying priest", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: createChurchBuilding("day"),
        piece: createPriest("day"),
      }),
    ];

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.faith).toBe(1);
  });

  it("does not produce faith from church without priest", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: createChurchBuilding("day"),
        piece: null,
      }),
    ];

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.faith).toBe(0);
  });

  it("produces faith from multiple churches with priests", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: createChurchBuilding("day"),
        piece: createPriest("day"),
      }),
      makeTile(0, 1, {
        building: createChurchBuilding("day"),
        piece: createPriest("day"),
      }),
      makeTile(0, 2, {
        building: createChurchBuilding("day"),
        piece: createPriest("day"),
      }),
    ];

    const production = calculateProduction("day", tiles, createResearch());
    expect(production.faith).toBe(3);
  });
});

describe("countPrayingPriests", () => {
  it("counts priests in churches", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: createChurchBuilding("day"),
        piece: createPriest("day"),
      }),
      makeTile(0, 1, {
        building: createChurchBuilding("day"),
        piece: createPriest("day"),
      }),
      makeTile(0, 2, {
        building: createChurchBuilding("day"),
        piece: null,
      }),
    ];

    expect(countPrayingPriests("day", tiles)).toBe(2);
  });

  it("does not count enemy priests", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: createChurchBuilding("night"),
        piece: createPriest("night"),
      }),
    ];

    expect(countPrayingPriests("day", tiles)).toBe(0);
  });

  it("does not count priests outside churches", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        piece: createPriest("day"),
      }),
    ];

    expect(countPrayingPriests("day", tiles)).toBe(0);
  });
});
