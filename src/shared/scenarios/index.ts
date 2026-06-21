/**
 * Test scenarios — small, hand-authored maps for exercising the engine and
 * the rendering/input layer without generating a full random game.
 *
 * A scenario is authored as an ASCII grid (one whitespace-separated token per
 * tile) and compiled into a real `Game` via `buildScenarioGame`. Because the
 * engine is pure, the same scenario can drive the /dev test interface, unit
 * tests, or a CLI playthrough.
 *
 * Token legend:
 *   .  grass        T  tree (loot: wood)     M  mountain (loot: stone)
 *   ~  water        s  sand                  f  farm
 *   p  day peasant  P  night peasant
 *   k  day king     K  night king
 *   r  day priest   R  night priest
 *
 * Pieces always stand on grass; the surrounding tokens describe the terrain
 * to test against.
 */

import {
  grass,
  farm,
  water,
  sand,
  mountain,
  tree,
} from "@shared/map/landscape.ts";
import type { Landscape } from "@shared/map/landscape.ts";
import {
  createPeasant,
  createKing,
  createPriest,
  type Piece,
  type PlayerType,
} from "@shared/piece/index.ts";
import { BuildingType, createBuilding } from "@shared/building/index.ts";
import { createPlayer } from "@shared/player/index.ts";
import { createResourceMap } from "@shared/player/resource-map.ts";
import type { Tile } from "@shared/map/tile.ts";
import type { Game, GameClock } from "@shared/game/types.ts";

type ScenarioBuilding = {
  readonly row: number;
  readonly column: number;
  readonly type: BuildingType;
  readonly owner: PlayerType;
};

export type Scenario = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly map: string;
  readonly currentPlayer?: PlayerType;
  // Buildings are placed by coordinate after the ASCII terrain/pieces are laid
  // out (the grid only encodes terrain and pieces).
  readonly buildings?: ReadonlyArray<ScenarioBuilding>;
};

type TokenSpec = {
  readonly landscape: () => Landscape;
  readonly piece?: () => Piece;
};

const TOKENS: Readonly<Record<string, TokenSpec>> = {
  ".": { landscape: grass },
  T: { landscape: tree },
  M: { landscape: mountain },
  "~": { landscape: water },
  s: { landscape: sand },
  f: { landscape: farm },
  p: { landscape: grass, piece: () => createPeasant("day") },
  P: { landscape: grass, piece: () => createPeasant("night") },
  k: { landscape: grass, piece: () => createKing("day") },
  K: { landscape: grass, piece: () => createKing("night") },
  r: { landscape: grass, piece: () => createPriest("day") },
  R: { landscape: grass, piece: () => createPriest("night") },
};

// Generous resources so building/crafting actions are affordable while testing.
const sandboxResources = () =>
  createResourceMap({
    wood: 50,
    stone: 50,
    iron: 50,
    gold: 50,
    food: 50,
    faith: 200,
  });

const parseRows = (map: string): ReadonlyArray<ReadonlyArray<string>> =>
  map
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/));

const tokenToTile = (token: string, row: number, column: number): Tile => {
  const spec = TOKENS[token];
  if (spec === undefined) {
    throw new Error(
      `Unknown scenario token "${token}" at row ${row}, column ${column}`,
    );
  }
  return {
    row,
    column,
    landscape: spec.landscape(),
    piece: spec.piece !== undefined ? spec.piece() : null,
    building: null,
  };
};

const clockForPlayer = (player: PlayerType): GameClock =>
  player === "day"
    ? { time: 6, hasDawned: true, hasDusked: false }
    : { time: 18, hasDawned: true, hasDusked: true };

/**
 * Compile a scenario into a playable `Game`.
 */
export const buildScenarioGame = (scenario: Scenario): Game => {
  const rows = parseRows(scenario.map);
  const tiles = rows.flatMap((tokens, row) =>
    tokens.map((token, column) => tokenToTile(token, row, column)),
  );
  const tilesWithBuildings = (scenario.buildings ?? []).reduce(
    (acc, spec) =>
      acc.map((tile) =>
        tile.row === spec.row && tile.column === spec.column
          ? { ...tile, building: createBuilding(spec.type, spec.owner) }
          : tile,
      ),
    tiles,
  );
  const size = Math.max(rows.length, ...rows.map((tokens) => tokens.length));
  const currentPlayer = scenario.currentPlayer ?? "day";

  return {
    id: `scenario:${scenario.id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    name: scenario.name,
    size,
    tiles: tilesWithBuildings,
    dayPlayer: createPlayer({ type: "day", resources: sandboxResources() }),
    nightPlayer: createPlayer({ type: "night", resources: sandboxResources() }),
    currentPlayer,
    clock: clockForPlayer(currentPlayer),
    creatorEmail: "dev@local",
    gameOver: false,
    winner: null,
  };
};

export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: "pawn-on-grass",
    name: "Pawn on grass",
    description:
      "A lone day peasant on open grass. Should be able to step to any adjacent tile.",
    map: `
      . . . . .
      . . . . .
      . . p . .
      . . . . .
      . . . . .
    `,
  },
  {
    id: "tree-wall",
    name: "Blocked by trees",
    description:
      "A vertical wall of trees. The peasant cannot step onto or across the tree column (no bow).",
    map: `
      . . T . .
      . . T . .
      . p T . .
      . . T . .
      . . T . .
    `,
  },
  {
    id: "sand-and-water",
    name: "Sand and water",
    description: "Peasant can walk onto sand but never into water (no boat).",
    map: `
      ~ ~ ~ ~ ~
      s s s s ~
      . p s s ~
      . . . s ~
      . . . . .
    `,
  },
  {
    id: "harvest-tree",
    name: "Harvest a tree",
    description:
      "Click the adjacent tree to harvest 1 wood — the tile should become walkable grass.",
    map: `
      . . . . .
      . p T . .
      . . . . .
    `,
  },
  {
    id: "harvest-mountain",
    name: "Harvest a mountain",
    description:
      "Click the adjacent mountain to harvest 1 stone — the tile should become grass.",
    map: `
      . . . . .
      . p M . .
      . . . . .
    `,
  },
  {
    id: "tower-vision",
    name: "Tower vision",
    description:
      "Two day peasants. The left one alone sees one ring; the right one stands in a tower and its vision is amplified to the tower's range (4). Select each to compare the highlighted view area.",
    map: `
      . . . . . . . . .
      . . . . . . . . .
      . p . . . . p . .
      . . . . . . . . .
      . . . . . . . . .
    `,
    buildings: [{ row: 2, column: 6, type: BuildingType.tower, owner: "day" }],
  },
  {
    id: "duel",
    name: "Two kings",
    description:
      "Day and night kings a few tiles apart for movement and attack testing. Day moves first.",
    map: `
      k . . . .
      . . . . .
      . . . . .
      . . . . .
      . . . . K
    `,
    currentPlayer: "day",
  },
];
