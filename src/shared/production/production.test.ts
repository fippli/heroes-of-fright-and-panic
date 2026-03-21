import { describe, it, expect } from "vitest";
import { Building, BuildingType } from "@shared/building/index.ts";
import { Landscape, LandscapeType } from "@shared/map/landscape.ts";
import type { Tile } from "@shared/map/tile.ts";
import { Piece, PieceKind } from "@shared/piece/index.ts";
import { Research } from "@shared/research/index.ts";
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
  landscape: Landscape.grass(),
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
    building: Building.house(owner),
    piece: Piece.peasant(owner),
  });

  // Neighbors: (0,0) is west, (0,2) is east
  const tiles: Tile[] = [
    makeTile(0, 0, { landscape: neighborLandscapes.at(0) ?? Landscape.grass() }),
    houseTile,
    makeTile(0, 2, { landscape: neighborLandscapes.at(1) ?? Landscape.grass() }),
  ];

  return tiles;
};

describe("calculateProduction", () => {
  it("produces food from adjacent farm tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      Landscape.farm(),
      Landscape.farm(),
    ]);

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.food).toBe(2);
    expect(production.wood).toBe(0);
  });

  it("produces wood from adjacent tree tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      Landscape.tree(),
      Landscape.grass(),
    ]);

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.wood).toBe(1);
  });

  it("produces stone from adjacent mountain tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      Landscape.mountain(),
      Landscape.grass(),
    ]);

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.stone).toBe(1);
    expect(production.iron).toBe(0);
    expect(production.gold).toBe(0);
  });

  it("produces stone + iron from mountain with Mining II", () => {
    const tiles = makeHouseWithNeighbors("day", [
      Landscape.mountain(),
      Landscape.grass(),
    ]);

    const research = new Research({ hasMiningII: true });
    const production = calculateProduction("day", tiles, research);
    expect(production.stone).toBe(1);
    expect(production.iron).toBe(1);
    expect(production.gold).toBe(0);
  });

  it("produces stone + iron + gold from mountain with Mining III", () => {
    const tiles = makeHouseWithNeighbors("day", [
      Landscape.mountain(),
      Landscape.grass(),
    ]);

    const research = new Research({ hasMiningII: true, hasMiningIII: true });
    const production = calculateProduction("day", tiles, research);
    expect(production.stone).toBe(1);
    expect(production.iron).toBe(1);
    expect(production.gold).toBe(1);
  });

  it("does not produce from house without peasant", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, { landscape: Landscape.farm() }),
      makeTile(0, 1, {
        building: Building.house("day"),
        piece: null, // no peasant
      }),
      makeTile(0, 2, { landscape: Landscape.farm() }),
    ];

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.food).toBe(0);
  });

  it("does not produce from enemy houses", () => {
    const tiles = makeHouseWithNeighbors("night", [
      Landscape.farm(),
      Landscape.farm(),
    ]);

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.food).toBe(0);
  });

  it("each terrain tile produces once regardless of adjacent house count", () => {
    // Two houses share a farm tile between them
    // House at (0,0) and house at (0,2), shared farm at (0,1)
    const sharedFarm = makeTile(0, 1, { landscape: Landscape.farm() });
    const house1 = makeTile(0, 0, {
      building: Building.house("day"),
      piece: Piece.peasant("day"),
    });
    const house2 = makeTile(0, 2, {
      building: Building.house("day"),
      piece: Piece.peasant("day"),
    });

    const tiles = [house1, sharedFarm, house2];
    const production = calculateProduction("day", tiles, new Research({}));
    // The farm at (0,1) should only produce once
    expect(production.food).toBe(1);
  });

  it("does not produce from water, sand, grass, or unexplored tiles", () => {
    const tiles = makeHouseWithNeighbors("day", [
      Landscape.water(),
      Landscape.sand(),
    ]);

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.food).toBe(0);
    expect(production.wood).toBe(0);
    expect(production.stone).toBe(0);
  });
});

describe("calculateChurchProduction", () => {
  it("produces faith from church with praying priest", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: Building.church("day"),
        piece: Piece.priest("day"),
      }),
    ];

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.faith).toBe(1);
  });

  it("does not produce faith from church without priest", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: Building.church("day"),
        piece: null,
      }),
    ];

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.faith).toBe(0);
  });

  it("produces faith from multiple churches with priests", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: Building.church("day"),
        piece: Piece.priest("day"),
      }),
      makeTile(0, 1, {
        building: Building.church("day"),
        piece: Piece.priest("day"),
      }),
      makeTile(0, 2, {
        building: Building.church("day"),
        piece: Piece.priest("day"),
      }),
    ];

    const production = calculateProduction("day", tiles, new Research({}));
    expect(production.faith).toBe(3);
  });
});

describe("countPrayingPriests", () => {
  it("counts priests in churches", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: Building.church("day"),
        piece: Piece.priest("day"),
      }),
      makeTile(0, 1, {
        building: Building.church("day"),
        piece: Piece.priest("day"),
      }),
      makeTile(0, 2, {
        building: Building.church("day"),
        piece: null,
      }),
    ];

    expect(countPrayingPriests("day", tiles)).toBe(2);
  });

  it("does not count enemy priests", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        building: Building.church("night"),
        piece: Piece.priest("night"),
      }),
    ];

    expect(countPrayingPriests("day", tiles)).toBe(0);
  });

  it("does not count priests outside churches", () => {
    const tiles: Tile[] = [
      makeTile(0, 0, {
        piece: Piece.priest("day"),
      }),
    ];

    expect(countPrayingPriests("day", tiles)).toBe(0);
  });
});
