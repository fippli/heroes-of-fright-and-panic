import { describe, expect, it } from "vitest";
import { connectLand, generateMap } from "./map.ts";
import { LandscapeType, grass, tree, water } from "./landscape.ts";
import type { Tile } from "./tile.ts";
import { findNeighborTiles } from "@shared/tile/index.ts";

// Small deterministic PRNG so the tests don't depend on the app's random module
const lcg = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const WALKABLE = [LandscapeType.grass, LandscapeType.sand, LandscapeType.farm];
const isWalkable = (tile: Tile) => tile.landscape !== null && WALKABLE.includes(tile.landscape.type);
const isLand = (tile: Tile) => tile.landscape !== null && tile.landscape.type !== LandscapeType.water;
const key = (tile: Tile) => `${tile.row},${tile.column}`;

/** Flood fill from `start` over tiles accepted by `pass` */
const reach = (tiles: readonly Tile[], start: Tile, pass: (tile: Tile) => boolean): Set<string> => {
  const seen = new Set([key(start)]);
  const stack = [start];
  while (stack.length > 0) {
    const tile = stack.pop() as Tile;
    findNeighborTiles(tiles, tile).forEach((n) => {
      if (pass(n) && !seen.has(key(n))) {
        seen.add(key(n));
        stack.push(n);
      }
    });
  }
  return seen;
};

const makeRow = (types: readonly ("g" | "t" | "w")[]): Tile[] =>
  types.map((type, column) => ({
    row: 0,
    column,
    landscape: type === "g" ? grass() : type === "t" ? tree() : water(),
    piece: null,
    building: null,
    steed: null,
  }));

describe("connectLand", () => {
  it("carves grass through the forest between two walkable patches", () => {
    const tiles = connectLand(makeRow(["g", "g", "t", "t", "t", "g", "g"]));
    expect(tiles.map((tile) => tile.landscape?.type)).toEqual([
      "grass", "grass", "grass", "grass", "grass", "grass", "grass",
    ]);
  });

  it("leaves land separated only by water alone", () => {
    const tiles = connectLand(makeRow(["g", "g", "w", "w", "g", "g"]));
    expect(tiles.filter((tile) => tile.landscape?.type === LandscapeType.water)).toHaveLength(2);
  });
});

describe("generateMap connectivity", () => {
  it.each([1, 2, 3, 4, 5, 6])("seed %i: every walkable tile reachable over land is connected", (seed) => {
    const tiles = generateMap(30, lcg(seed));
    const walkable = tiles.filter(isWalkable);
    expect(walkable.length).toBeGreaterThan(50);

    // Largest walkable component
    const seen = new Set<string>();
    let largest: Set<string> = new Set();
    walkable.forEach((tile) => {
      if (seen.has(key(tile))) return;
      const component = reach(tiles, tile, isWalkable);
      component.forEach((k) => seen.add(k));
      if (component.size > largest.size) largest = component;
    });

    // Anything reachable from it across land (obstacles included) must be in it
    const startTile = walkable.find((tile) => largest.has(key(tile))) as Tile;
    const landReach = reach(tiles, startTile, isLand);
    const stranded = walkable.filter((tile) => landReach.has(key(tile)) && !largest.has(key(tile)));
    expect(stranded).toHaveLength(0);
  });

  it("forests and mountains come in small clusters", () => {
    const tiles = generateMap(40, lcg(11));
    const obstacles = tiles.filter(
      (tile) => tile.landscape?.type === LandscapeType.tree || tile.landscape?.type === LandscapeType.mountain,
    );
    const isObstacle = (tile: Tile) =>
      tile.landscape?.type === LandscapeType.tree || tile.landscape?.type === LandscapeType.mountain;
    const seen = new Set<string>();
    const sizes: number[] = [];
    obstacles.forEach((tile) => {
      if (seen.has(key(tile))) return;
      const cluster = reach(tiles, tile, isObstacle);
      cluster.forEach((k) => seen.add(k));
      sizes.push(cluster.size);
    });
    const largest = Math.max(...sizes);
    const land = tiles.filter(isLand).length;
    // No single obstacle mass should dominate the island (the pre-fix noise
    // produced bands covering most of the land)
    expect(largest).toBeLessThan(land * 0.45);
  });
});
