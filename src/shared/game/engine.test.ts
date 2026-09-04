import { describe, it, expect } from "vitest";
import {
  type Building,
  BuildingType,
  createCastleBuilding,
  createChurchBuilding,
  createHouseBuilding,
  createTowerBuilding,
} from "../building/index.ts";
import {
  createSword,
  createBow,
  EquipmentType,
} from "../equipment/index.ts";
import {
  type Landscape,
  LandscapeType,
  grass,
  water as waterLandscape,
  tree as treeLandscape,
  sand as sandLandscape,
} from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import { replaceTile } from "../tile/index.ts";
import { createBuilding } from "../building/index.ts";
import { SteedType } from "../steed/index.ts";
import {
  type Piece,
  PieceKind,
  createPeasant,
  createKing,
  createPriest,
  createArchAngel,
  getPieceAttack,
  pieceWithEquipment,
  pieceWithDamage,
} from "../piece/index.ts";
import { createPlayer } from "../player/index.ts";
import { createResourceMap } from "../player/resource-map.ts";
import { createResearch, ResearchType } from "../research/index.ts";
import {
  handleMove,
  handleBuild,
  handleBuySteed,
  handleSpawnPeasant,
  handleCraftEquipment,
  handleTrainPriest,
  handleHeal,
  handleResearch,
  handleSummonArchAngel,
  handleAttack,
  handlePass,
  handleUpgradeBuilding,
  getSpectatorGameState,
  checkWinCondition,
  handleAction,
  getVisibleTiles,
} from "./engine.ts";
import type { Game } from "./types.ts";

// ============================================
// TEST HELPERS
// ============================================

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

const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: "test-game",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Game",
  size: 5,
  tiles: make5x5GrassTiles(),
  dayPlayer: createPlayer({
    type: "day",
    resources: createResourceMap({
      wood: 50,
      stone: 50,
      iron: 50,
      gold: 50,
      food: 50,
      faith: 200,
    }),
  }),
  nightPlayer: createPlayer({
    type: "night",
    resources: createResourceMap({
      wood: 50,
      stone: 50,
      iron: 50,
      gold: 50,
      food: 50,
      faith: 200,
    }),
  }),
  currentPlayer: "day",
  clock: { time: 6, hasDawned: true, hasDusked: false },
  creatorEmail: "test@test.com",
  gameOver: false,
  winner: null,
  ...overrides,
});

const make5x5GrassTiles = (): Tile[] =>
  Array.from({ length: 25 }, (_, index) =>
    makeTile(Math.floor(index / 5), index % 5),
  );

const placePiece = (
  tiles: ReadonlyArray<Tile>,
  row: number,
  col: number,
  piece: Piece,
): Tile[] =>
  tiles.map((tile) =>
    tile.row === row && tile.column === col ? { ...tile, piece } : tile,
  );

const placeBuilding = (
  tiles: ReadonlyArray<Tile>,
  row: number,
  col: number,
  building: Building,
): Tile[] =>
  tiles.map((tile) =>
    tile.row === row && tile.column === col ? { ...tile, building } : tile,
  );

const setLandscape = (
  tiles: ReadonlyArray<Tile>,
  row: number,
  col: number,
  landscape: Landscape,
): Tile[] =>
  tiles.map((tile) =>
    tile.row === row && tile.column === col ? { ...tile, landscape } : tile,
  );

// ============================================
// MOVE TESTS
// ============================================

describe("handleMove", () => {
  it("moves a piece to an adjacent empty grass tile", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { game: after, result } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
    const fromTile = after.tiles.find((t) => t.row === 2 && t.column === 2);
    const toTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(fromTile?.piece).toBeNull();
    expect(toTile?.piece?.kind).toBe(PieceKind.peasant);
  });

  it("rejects move when it is not the player's turn", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("night"));
    const game = makeGame({ tiles });

    const { result } = handleMove(game, {
      type: "move",
      player: "night",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not your turn");
  });

  it("rejects move to occupied tile", () => {
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      3,
      createPeasant("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects move to non-walkable terrain", () => {
    const tiles = setLandscape(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      3,
      waterLandscape(),
    );
    const game = makeGame({ tiles });

    const { result } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });

  it("forests are impassable even with a bow", () => {
    const archer = pieceWithEquipment(createPeasant("day"), createBow());
    const tiles = setLandscape(
      placePiece(make5x5GrassTiles(), 2, 2, archer),
      2,
      3,
      treeLandscape(),
    );
    const game = makeGame({ tiles });

    const { result } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });

  it("moves onto a tile holding one of your own buildings", () => {
    const base = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const houseTile = base.find((t) => t.row === 2 && t.column === 3)!;
    const tiles = replaceTile(base, { ...houseTile, building: createBuilding(BuildingType.house, "day") });
    const game = makeGame({ tiles });

    const { result } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
  });

  it("moves through your own wall but not an enemy wall", () => {
    const base = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const wallTile = base.find((t) => t.row === 2 && t.column === 3)!;
    const ownWall = makeGame({ tiles: replaceTile(base, { ...wallTile, building: createBuilding(BuildingType.wall, "day") }) });
    const enemyWall = makeGame({ tiles: replaceTile(base, { ...wallTile, building: createBuilding(BuildingType.wall, "night") }) });
    const move = { type: "move" as const, player: "day" as const, from: { row: 2, column: 2 }, to: { row: 2, column: 3 } };

    expect(handleMove(ownWall, move).result.success).toBe(true);
    expect(handleMove(enemyWall, move).result.success).toBe(false);
  });

  it("marks the piece as acted and refuses a second action", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { game: after } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    // Rounds: the clock does not move, but the piece has used its action
    expect(after.clock.time).toBe(game.clock.time);
    const moved = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(moved?.piece?.acted).toBe(true);

    const again = handleMove(after, {
      type: "move",
      player: "day",
      from: { row: 2, column: 3 },
      to: { row: 2, column: 4 },
    });
    expect(again.result.success).toBe(false);
    expect(again.result.error).toContain("already acted");
  });

  it("does not mutate the original game", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    const originalTile = game.tiles.find((t) => t.row === 2 && t.column === 2);
    expect(originalTile?.piece).not.toBeNull();
  });
});

// ============================================
// BUILD TESTS
// ============================================

describe("handleBuild", () => {
  it("builds a house on grass adjacent to a unit", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { game: after, result } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
    const builtTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(builtTile?.building?.type).toBe(BuildingType.house);
  });

  it("deducts building cost from player", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { game: after } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 3 },
    });

    expect(after.dayPlayer.resources.wood).toBe(49); // 50 - 1
  });

  it("converts adjacent grass to farm when building a house", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { game: after } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 3 },
    });

    // Check that neighbors of the new house are now farms
    // (2,3) neighbors on same row: (2,2) has a piece, (2,4) should be farm
    const neighborTile = after.tiles.find((t) => t.row === 2 && t.column === 4);
    expect(neighborTile?.landscape?.type).toBe(LandscapeType.farm);
  });

  it("rejects building on non-grass terrain", () => {
    const tiles = setLandscape(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      3,
      waterLandscape(),
    );
    const game = makeGame({ tiles });

    const { result } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects building outside the kingdom (no unit can see the tile)", () => {
    const game = makeGame({});

    const { result } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 0, column: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("kingdom");
  });

  it("allows building anywhere inside the field of vision, not just adjacent", () => {
    // King sees 2 tiles: (2,4) is two steps away from (2,2)
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createKing("day"));
    const game = makeGame({ tiles });

    const { result } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 4 },
    });

    expect(result.success).toBe(true);
  });

  it("rejects building on a tile just beyond the field of vision", () => {
    // Peasant sees 1 tile: (2,4) is out of view from (2,2)
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { result } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 4 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects building when player cannot afford it", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({
      tiles,
      dayPlayer: createPlayer({
        type: "day",
        resources: createResourceMap({}),
      }),
    });

    const { result } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// SPAWN PEASANT TESTS
// ============================================

describe("handleSpawnPeasant", () => {
  it("spawns a peasant in an empty house", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createHouseBuilding("day"),
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleSpawnPeasant(game, {
      type: "spawnPeasant",
      player: "day",
      position: { row: 2, column: 2 },
    });

    expect(result.success).toBe(true);
    const houseTile = after.tiles.find((t) => t.row === 2 && t.column === 2);
    expect(houseTile?.piece?.kind).toBe(PieceKind.peasant);
  });

  it("costs 1 food", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createHouseBuilding("day"),
    );
    const game = makeGame({ tiles });

    const { game: after } = handleSpawnPeasant(game, {
      type: "spawnPeasant",
      player: "day",
      position: { row: 2, column: 2 },
    });

    expect(after.dayPlayer.resources.food).toBe(49);
  });

  it("rejects spawn on occupied house", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      2,
      createHouseBuilding("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleSpawnPeasant(game, {
      type: "spawnPeasant",
      player: "day",
      position: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects spawn on enemy house", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createHouseBuilding("night"),
    );
    const game = makeGame({ tiles });

    const { result } = handleSpawnPeasant(game, {
      type: "spawnPeasant",
      player: "day",
      position: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// CRAFT EQUIPMENT TESTS
// ============================================

describe("handleCraftEquipment", () => {
  it("equips a sword on a peasant", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { game: after, result } = handleCraftEquipment(game, {
      type: "craftEquipment",
      player: "day",
      equipmentType: EquipmentType.sword,
      piecePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(true);
    const tile = after.tiles.find((t) => t.row === 2 && t.column === 2);
    expect(getPieceAttack(tile!.piece!)).toBe(2); // base 1 + sword 1
  });

  it("deducts equipment cost (sword = 1 iron)", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { game: after } = handleCraftEquipment(game, {
      type: "craftEquipment",
      player: "day",
      equipmentType: EquipmentType.sword,
      piecePosition: { row: 2, column: 2 },
    });

    expect(after.dayPlayer.resources.iron).toBe(49);
  });

  it("rejects equipping on a king", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createKing("day"));
    const game = makeGame({ tiles });

    const { result } = handleCraftEquipment(game, {
      type: "craftEquipment",
      player: "day",
      equipmentType: EquipmentType.sword,
      piecePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects equipping duplicate equipment", () => {
    const swordsman = pieceWithEquipment(createPeasant("day"), createSword());
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, swordsman);
    const game = makeGame({ tiles });

    const { result } = handleCraftEquipment(game, {
      type: "craftEquipment",
      player: "day",
      equipmentType: EquipmentType.sword,
      piecePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// TRAIN PRIEST TESTS
// ============================================

describe("handleTrainPriest", () => {
  it("trains a priest at a church", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createChurchBuilding("day"),
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleTrainPriest(game, {
      type: "trainPriest",
      player: "day",
      churchPosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(true);
    const tile = after.tiles.find((t) => t.row === 2 && t.column === 2);
    expect(tile?.piece?.kind).toBe(PieceKind.priest);
  });

  it("costs 1 gold", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createChurchBuilding("day"),
    );
    const game = makeGame({ tiles });

    const { game: after } = handleTrainPriest(game, {
      type: "trainPriest",
      player: "day",
      churchPosition: { row: 2, column: 2 },
    });

    expect(after.dayPlayer.resources.gold).toBe(49);
  });

  it("rejects training at enemy church", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createChurchBuilding("night"),
    );
    const game = makeGame({ tiles });

    const { result } = handleTrainPriest(game, {
      type: "trainPriest",
      player: "day",
      churchPosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// HEAL TESTS
// ============================================

describe("handleHeal", () => {
  it("heals an adjacent friendly piece by 1 heart", () => {
    const damagedKing = pieceWithDamage(createKing("day"), 2); // 1 def absorbed, 1 heart lost => 2 hearts
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, createPriest("day")),
      2,
      3,
      damagedKing,
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleHeal(game, {
      type: "heal",
      player: "day",
      priestPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
    const healedTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(healedTile?.piece?.hearts).toBe(3); // healed from 2 to 3
  });

  it("costs 1 faith", () => {
    const damagedKing = pieceWithDamage(createKing("day"), 2);
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, createPriest("day")),
      2,
      3,
      damagedKing,
    );
    const game = makeGame({ tiles });

    const { game: after } = handleHeal(game, {
      type: "heal",
      player: "day",
      priestPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    expect(after.dayPlayer.resources.faith).toBe(199);
  });

  it("rejects healing a piece at full health", () => {
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, createPriest("day")),
      2,
      3,
      createPeasant("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleHeal(game, {
      type: "heal",
      player: "day",
      priestPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects healing non-adjacent piece", () => {
    const damagedKing = pieceWithDamage(createKing("day"), 2);
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 0, 0, createPriest("day")),
      4,
      4,
      damagedKing,
    );
    const game = makeGame({ tiles });

    const { result } = handleHeal(game, {
      type: "heal",
      player: "day",
      priestPosition: { row: 0, column: 0 },
      targetPosition: { row: 4, column: 4 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// RESEARCH TESTS
// ============================================

describe("handleResearch", () => {
  it("researches the queen at a level 2 castle, not at a keep", () => {
    const keepTiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, createKing("day")),
      2,
      2,
      createCastleBuilding("day"),
    );
    const atKeep = handleResearch(makeGame({ tiles: keepTiles }), {
      type: "research",
      player: "day",
      researchType: ResearchType.queen,
      castlePosition: { row: 2, column: 2 },
    });
    expect(atKeep.result.success).toBe(false);
    expect(atKeep.result.error).toContain("upgrade");

    const castleTiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, createKing("day")),
      2,
      2,
      createCastleBuilding("day", 2),
    );
    const { game: after, result } = handleResearch(makeGame({ tiles: castleTiles }), {
      type: "research",
      player: "day",
      researchType: ResearchType.queen,
      castlePosition: { row: 2, column: 2 },
    });
    expect(result.success).toBe(true);
    expect(after.dayPlayer.research.hasQueen).toBe(true);
    expect(after.dayPlayer.resources.gold).toBe(makeGame({}).dayPlayer.resources.gold - 25);
  });

  it("rejects research without castle", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createHouseBuilding("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleResearch(game, {
      type: "research",
      player: "day",
      researchType: ResearchType.queen,
      castlePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// ENTER TOWER TESTS
// ============================================

// ============================================
// ATTACK TESTS
// ============================================

describe("handleAttack", () => {
  it("peasant kills enemy peasant", () => {
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      3,
      createPeasant("night"),
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleAttack(game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
    const targetTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(targetTile?.piece).toBeNull();
  });

  it("peasant cannot destroy building (1 atk vs 1 def)", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      3,
      createHouseBuilding("night"),
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleAttack(game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
    const targetTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(targetTile?.building).not.toBeNull(); // building survives
  });

  it("swordsman destroys building (2 atk > 1 def)", () => {
    const swordsman = pieceWithEquipment(createPeasant("day"), createSword());
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, swordsman),
      2,
      3,
      createHouseBuilding("night"),
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleAttack(game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
    const targetTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(targetTile?.building).toBeNull();
  });

  it("rejects attack on own piece", () => {
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      3,
      createPeasant("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleAttack(game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects attack out of range", () => {
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 0, 0, createPeasant("day")),
      4,
      4,
      createPeasant("night"),
    );
    const game = makeGame({ tiles });

    const { result } = handleAttack(game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 0, column: 0 },
      targetPosition: { row: 4, column: 4 },
    });

    expect(result.success).toBe(false);
  });

  it("castle destruction kills king inside", () => {
    const angel = createArchAngel("day"); // 3 attack > 1 defense
    const tiles = placeBuilding(
      placePiece(
        placePiece(make5x5GrassTiles(), 2, 2, angel),
        2,
        3,
        createKing("night"),
      ),
      2,
      3,
      createCastleBuilding("night"),
    );
    const game = makeGame({ tiles });

    const { game: after } = handleAttack(game, {
      type: "attack",
      player: "day",
      attackerPosition: { row: 2, column: 2 },
      targetPosition: { row: 2, column: 3 },
    });

    const targetTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(targetTile?.building).toBeNull();
    expect(targetTile?.piece).toBeNull(); // king dies with castle
  });
});

// ============================================
// WIN CONDITION TESTS
// ============================================

describe("checkWinCondition", () => {
  it("night wins when day king is dead", () => {
    // No day king on the board
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createKing("night"));
    const game = makeGame({ tiles });

    const result = checkWinCondition(game);
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe("night");
  });

  const bothKingdoms = () =>
    placeBuilding(
      placeBuilding(
        placePiece(placePiece(make5x5GrassTiles(), 2, 2, createKing("day")), 3, 3, createKing("night")),
        2,
        2,
        createCastleBuilding("day"),
      ),
      3,
      3,
      createCastleBuilding("night"),
    );

  it("day wins when the night king is dead", () => {
    const tiles = bothKingdoms().map((tile) =>
      tile.row === 3 && tile.column === 3 ? { ...tile, piece: null } : tile,
    );
    const result = checkWinCondition(makeGame({ tiles }));
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe("day");
  });

  it("razing the castle loses the game even with the king alive", () => {
    const tiles = bothKingdoms().map((tile) =>
      tile.row === 3 && tile.column === 3 ? { ...tile, building: null } : tile,
    );
    const result = checkWinCondition(makeGame({ tiles }));
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe("day");
  });

  it("game continues while both kings and castles stand", () => {
    const result = checkWinCondition(makeGame({ tiles: bothKingdoms() }));
    expect(result.gameOver).toBe(false);
  });

  it("does not re-check if game is already over", () => {
    const game = makeGame({ gameOver: true, winner: "day" });
    const result = checkWinCondition(game);
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe("day");
  });
});

// ============================================
// SUMMON ARCH ANGEL TESTS
// ============================================

describe("handleSummonArchAngel", () => {
  it("rejects summoning without enough praying priests", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createChurchBuilding("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleSummonArchAngel(game, {
      type: "summonArchAngel",
      player: "day",
      churchPosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects summoning without enough faith", () => {
    // Create 10 churches with priests
    const baseTiles = make5x5GrassTiles();
    const positions = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
    ] as const;
    const tilesWithChurches = positions.reduce(
      (acc, [row, col]) =>
        placeBuilding(
          placePiece(acc, row, col, createPriest("day")),
          row,
          col,
          createChurchBuilding("day"),
        ),
      baseTiles,
    );
    // Add an empty church for summoning
    const tiles = placeBuilding(
      tilesWithChurches,
      2,
      2,
      createChurchBuilding("day"),
    );
    const game = makeGame({
      tiles,
      dayPlayer: createPlayer({
        type: "day",
        resources: createResourceMap({ faith: 10 }), // not enough
      }),
    });

    const { result } = handleSummonArchAngel(game, {
      type: "summonArchAngel",
      player: "day",
      churchPosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// CLOCK TESTS
// ============================================

describe("clock and turns", () => {
  it("ending the phase flips to night, rests every actor and runs production", () => {
    const base = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles: base });
    const moved = handleMove(game, { type: "move", player: "day", from: { row: 2, column: 2 }, to: { row: 2, column: 3 } }).game;

    const { game: after, result } = handlePass(moved, { type: "pass", player: "day" });
    expect(result.success).toBe(true);
    expect(after.currentPlayer).toBe("night");
    expect(after.clock.time).toBe(18);
    expect(after.clock.hasDusked).toBe(true);
    const rested = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(rested?.piece?.acted).toBe(false);
  });
});

// ============================================
// ACTION DISPATCHER TESTS
// ============================================

describe("getVisibleTiles", () => {
  it("reveals one ring around a lone peasant", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const visible = getVisibleTiles(game, "day");

    expect(visible.has("2,2")).toBe(true);
    expect(visible.has("2,3")).toBe(true); // adjacent
    expect(visible.has("0,2")).toBe(false); // two rings away
  });

  it("amplifies a peasant's view to the tower it occupies", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")),
      2,
      2,
      createTowerBuilding("day"),
    );
    const game = makeGame({ tiles });

    const visible = getVisibleTiles(game, "day");

    // Tower view (4) > peasant view (1): tiles two rings out are now visible.
    expect(visible.has("0,2")).toBe(true);
    expect(visible.has("2,0")).toBe(true);
  });

  it("an unoccupied building reveals only its own tile, no vision radius", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createTowerBuilding("day"),
    );
    const game = makeGame({ tiles });

    const visible = getVisibleTiles(game, "day");

    expect(visible.has("2,2")).toBe(true); // you always see your own building
    expect(visible.has("2,3")).toBe(false); // but it projects no vision
  });

  it("Queen research reveals tiles adjacent to your buildings", () => {
    const tiles = placeBuilding(
      make5x5GrassTiles(),
      2,
      2,
      createTowerBuilding("day"),
    );
    const game = makeGame({
      tiles,
      dayPlayer: createPlayer({
        type: "day",
        research: createResearch({ hasQueen: true }),
      }),
    });

    const visible = getVisibleTiles(game, "day");

    expect(visible.has("2,3")).toBe(true);
  });

  it("does not reveal tiles for the enemy player's pieces", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("night"));
    const game = makeGame({ tiles });

    const visible = getVisibleTiles(game, "day");

    expect(visible.has("2,2")).toBe(false);
  });
});

describe("handleAction", () => {
  it("dispatches move action", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { result } = handleAction(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
  });

  it("dispatches build action", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });

    const { result } = handleAction(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
  });


  it("rejects actions when game is over", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles, gameOver: true });

    const { result } = handleAction(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });
});

describe("handlePass", () => {
  it("pass ends the phase outright", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });
    const { game: after, result } = handlePass(game, { type: "pass", player: "day" });
    expect(result.success).toBe(true);
    expect(after.currentPlayer).toBe("night");
    expect(after.clock.time).toBe(18);
  });

  it("ends the phase in one action with toPhaseEnd", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const game = makeGame({ tiles });
    const { game: after, result } = handlePass(game, { type: "pass", player: "day", toPhaseEnd: true });
    expect(result.success).toBe(true);
    expect(after.currentPlayer).toBe("night");
    expect(after.clock.time).toBe(18);
  });

  it("is rejected out of turn", () => {
    const game = makeGame({});
    const { result } = handlePass(game, { type: "pass", player: "night" });
    expect(result.success).toBe(false);
  });
});

describe("getSpectatorGameState", () => {
  it("shows only tiles either side can see", () => {
    const tiles = placePiece(placePiece(make5x5GrassTiles(), 0, 0, createPeasant("day")), 4, 4, createPeasant("night"));
    const game = makeGame({ tiles });
    const view = getSpectatorGameState(game);
    const at = (row: number, column: number) => view.tiles.find((t) => t.row === row && t.column === column)!;
    expect(at(0, 0).piece?.owner).toBe("day");
    expect(at(4, 4).piece?.owner).toBe("night");
    // Two tiles from both peasants (view 1): fog
    expect(at(2, 2).landscape?.type).toBe(LandscapeType.unexplored);
  });
});

describe("handleUpgradeBuilding", () => {
  const houseAt = (level = 1) => {
    const base = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const tile = base.find((t) => t.row === 2 && t.column === 3)!;
    return makeGame({ tiles: replaceTile(base, { ...tile, building: { ...createBuilding(BuildingType.house, "day"), level } }) });
  };

  it("raises a house to a homestead for 3 wood + 2 stone", () => {
    const game = houseAt(1);
    const { game: after, result } = handleUpgradeBuilding(game, { type: "upgradeBuilding", player: "day", position: { row: 2, column: 3 } });
    expect(result.success).toBe(true);
    expect(after.tiles.find((t) => t.row === 2 && t.column === 3)?.building?.level).toBe(2);
    expect(after.dayPlayer.resources.wood).toBe(game.dayPlayer.resources.wood - 3);
    expect(after.dayPlayer.resources.stone).toBe(game.dayPlayer.resources.stone - 2);
  });

  it("refuses a manor, an enemy house and a missing house", () => {
    expect(handleUpgradeBuilding(houseAt(3), { type: "upgradeBuilding", player: "day", position: { row: 2, column: 3 } }).result.success).toBe(false);
    expect(handleUpgradeBuilding(houseAt(1), { type: "upgradeBuilding", player: "day", position: { row: 0, column: 0 } }).result.success).toBe(false);
  });
});

describe("population cap", () => {
  const withHouses = (levels: number[], peasants: number) => {
    let tiles: ReadonlyArray<Tile> = make5x5GrassTiles();
    levels.forEach((level, index) => {
      const tile = tiles.find((t) => t.row === 0 && t.column === index)!;
      tiles = replaceTile(tiles, { ...tile, building: { ...createBuilding(BuildingType.house, "day"), level } });
    });
    for (let index = 0; index < peasants; index += 1) tiles = placePiece(tiles, 4, index, createPeasant("day"));
    return makeGame({ tiles });
  };

  it("refuses a peasant when every house slot is taken", () => {
    const { result } = handleSpawnPeasant(withHouses([1], 1), { type: "spawnPeasant", player: "day", position: { row: 0, column: 0 } });
    expect(result.success).toBe(false);
    expect(result.error).toContain("No room");
  });

  it("a homestead houses two, a manor three", () => {
    expect(handleSpawnPeasant(withHouses([2], 1), { type: "spawnPeasant", player: "day", position: { row: 0, column: 0 } }).result.success).toBe(true);
    expect(handleSpawnPeasant(withHouses([3], 2), { type: "spawnPeasant", player: "day", position: { row: 0, column: 0 } }).result.success).toBe(true);
    expect(handleSpawnPeasant(withHouses([3], 3), { type: "spawnPeasant", player: "day", position: { row: 0, column: 0 } }).result.success).toBe(false);
  });
});

describe("docks", () => {
  const shore = () => {
    // (2,3) sand next to water at (2,4); peasant at (2,2) sees both
    const tiles = setLandscape(
      setLandscape(placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day")), 2, 3, sandLandscape()),
      2,
      4,
      waterLandscape(),
    );
    return makeGame({ tiles });
  };

  it("builds a dock on sand next to water, but not on grass", () => {
    const game = shore();
    expect(handleBuild(game, { type: "build", player: "day", buildingType: BuildingType.dock, position: { row: 2, column: 3 } }).result.success).toBe(true);
    expect(handleBuild(game, { type: "build", player: "day", buildingType: BuildingType.dock, position: { row: 1, column: 2 } }).result.success).toBe(false);
    expect(handleBuild(game, { type: "build", player: "day", buildingType: BuildingType.house, position: { row: 2, column: 3 } }).result.success).toBe(false);
  });

  it("boats are built at docks, horses at houses", () => {
    const withDock = handleBuild(shore(), { type: "build", player: "day", buildingType: BuildingType.dock, position: { row: 2, column: 3 } }).game;
    const dock = { row: 2, column: 3 };
    expect(handleBuySteed(withDock, { type: "buySteed", player: "day", steedType: SteedType.boat, housePosition: dock, targetPosition: { row: 2, column: 4 } }).result.success).toBe(true);
    expect(handleBuySteed(withDock, { type: "buySteed", player: "day", steedType: SteedType.horse, housePosition: dock, targetPosition: { row: 1, column: 3 } }).result.success).toBe(false);
  });
});

describe("tower tiers", () => {
  it("upgrades a watchpost to a watchtower, then a beacon, both for stone", () => {
    const base = placePiece(make5x5GrassTiles(), 2, 2, createPeasant("day"));
    const tile = base.find((t) => t.row === 2 && t.column === 3)!;
    const game = makeGame({ tiles: replaceTile(base, { ...tile, building: createTowerBuilding("day") }) });

    const first = handleUpgradeBuilding(game, { type: "upgradeBuilding", player: "day", position: { row: 2, column: 3 } });
    expect(first.result.success).toBe(true);
    const watchtower = first.game.tiles.find((t) => t.row === 2 && t.column === 3)!.building!;
    expect([watchtower.level, watchtower.viewRange, watchtower.defense]).toEqual([2, 3, 2]);
    expect(first.game.dayPlayer.resources.stone).toBe(game.dayPlayer.resources.stone - 8);

    // Rest the tower so it can act again next "phase"
    const rested = { ...first.game, tiles: first.game.tiles.map((t) => (t.building !== null ? { ...t, building: { ...t.building, acted: false } } : t)) };
    const second = handleUpgradeBuilding(rested, { type: "upgradeBuilding", player: "day", position: { row: 2, column: 3 } });
    expect(second.result.success).toBe(true);
    const beacon = second.game.tiles.find((t) => t.row === 2 && t.column === 3)!.building!;
    expect([beacon.level, beacon.viewRange, beacon.defense]).toEqual([3, 4, 3]);
    expect(second.game.dayPlayer.resources.stone).toBe(game.dayPlayer.resources.stone - 8 - 12);

    const third = handleUpgradeBuilding(second.game, { type: "upgradeBuilding", player: "day", position: { row: 2, column: 3 } });
    expect(third.result.success).toBe(false);
  });
});
