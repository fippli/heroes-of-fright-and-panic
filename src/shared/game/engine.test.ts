import { describe, it, expect } from "vitest";
import { Building, BuildingType } from "../building/index.ts";
import { Equipment, EquipmentType } from "../equipment/index.ts";
import { Landscape, LandscapeType } from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import { Piece, PieceKind } from "../piece/index.ts";
import { Player } from "../player/index.ts";
import { ResourceMap } from "../player/resource-map.ts";
import { Research, ResearchType } from "../research/index.ts";
import {
  handleMove,
  handleBuild,
  handleSpawnPeasant,
  handleCraftEquipment,
  handleTrainPriest,
  handleHeal,
  handleResearch,
  handleEnterTower,
  handleSummonArchAngel,
  handleAttack,
  checkWinCondition,
  handleAction,
} from "./engine.ts";
import type { Game, GameClock } from "./types.ts";

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
  landscape: Landscape.grass(),
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
  dayPlayer: new Player({
    type: "day",
    resources: new ResourceMap({ wood: 50, stone: 50, iron: 50, gold: 50, food: 50, faith: 200 }),
  }),
  nightPlayer: new Player({
    type: "night",
    resources: new ResourceMap({ wood: 50, stone: 50, iron: 50, gold: 50, food: 50, faith: 200 }),
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

const placePiece = (tiles: ReadonlyArray<Tile>, row: number, col: number, piece: Piece): Tile[] =>
  tiles.map((tile) =>
    tile.row === row && tile.column === col ? { ...tile, piece } : tile,
  );

const placeBuilding = (tiles: ReadonlyArray<Tile>, row: number, col: number, building: Building): Tile[] =>
  tiles.map((tile) =>
    tile.row === row && tile.column === col ? { ...tile, building } : tile,
  );

const setLandscape = (tiles: ReadonlyArray<Tile>, row: number, col: number, landscape: Landscape | ReturnType<typeof Landscape.grass>): Tile[] =>
  tiles.map((tile) =>
    tile.row === row && tile.column === col ? { ...tile, landscape } : tile,
  );

// ============================================
// MOVE TESTS
// ============================================

describe("handleMove", () => {
  it("moves a piece to an adjacent empty grass tile", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("night"));
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
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 3, Piece.peasant("day"),
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
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 3, Landscape.water(),
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

  it("bow-equipped piece can walk on trees", () => {
    const archer = Piece.peasant("day").withEquipment(Equipment.bow());
    const tiles = setLandscape(
      placePiece(make5x5GrassTiles(), 2, 2, archer),
      2, 3, Landscape.tree(),
    );
    const game = makeGame({ tiles });

    const { result } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
  });

  it("advances the clock after a successful move", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
    const game = makeGame({ tiles });

    const { game: after } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(after.clock.time).toBe(7); // default speed = 60 min = 1 hour
  });

  it("does not mutate the original game", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 3, Landscape.water(),
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

  it("rejects building without adjacent unit", () => {
    const game = makeGame({});

    const { result } = handleBuild(game, {
      type: "build",
      player: "day",
      buildingType: BuildingType.house,
      position: { row: 0, column: 0 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects building when player cannot afford it", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
    const game = makeGame({
      tiles,
      dayPlayer: new Player({
        type: "day",
        resources: new ResourceMap({}),
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
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.house("day"));
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
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.house("day"));
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
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 2, Building.house("day"),
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
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.house("night"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
    const game = makeGame({ tiles });

    const { game: after, result } = handleCraftEquipment(game, {
      type: "craftEquipment",
      player: "day",
      equipmentType: EquipmentType.sword,
      piecePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(true);
    const tile = after.tiles.find((t) => t.row === 2 && t.column === 2);
    expect(tile?.piece?.attack).toBe(2); // base 1 + sword 1
  });

  it("deducts equipment cost (sword = 1 iron)", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.king("day"));
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
    const swordsman = Piece.peasant("day").withEquipment(Equipment.sword());
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
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.church("day"));
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
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.church("day"));
    const game = makeGame({ tiles });

    const { game: after } = handleTrainPriest(game, {
      type: "trainPriest",
      player: "day",
      churchPosition: { row: 2, column: 2 },
    });

    expect(after.dayPlayer.resources.gold).toBe(49);
  });

  it("rejects training at enemy church", () => {
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.church("night"));
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
    const damagedKing = Piece.king("day").withDamage(2); // 1 def absorbed, 1 heart lost => 2 hearts
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.priest("day")),
      2, 3, damagedKing,
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
    const damagedKing = Piece.king("day").withDamage(2);
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.priest("day")),
      2, 3, damagedKing,
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
      placePiece(make5x5GrassTiles(), 2, 2, Piece.priest("day")),
      2, 3, Piece.peasant("day"),
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
    const damagedKing = Piece.king("day").withDamage(2);
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 0, 0, Piece.priest("day")),
      4, 4, damagedKing,
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
  it("researches speed at castle", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.king("day")),
      2, 2, Building.castle("day"),
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleResearch(game, {
      type: "research",
      player: "day",
      researchType: ResearchType.speed,
      castlePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(true);
    expect(after.dayPlayer.research.speedLevel).toBe(1);
  });

  it("deducts research cost (speed = 1 wood)", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.king("day")),
      2, 2, Building.castle("day"),
    );
    const game = makeGame({ tiles });

    const { game: after } = handleResearch(game, {
      type: "research",
      player: "day",
      researchType: ResearchType.speed,
      castlePosition: { row: 2, column: 2 },
    });

    expect(after.dayPlayer.resources.wood).toBe(49);
  });

  it("rejects research without castle", () => {
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.house("day"));
    const game = makeGame({ tiles });

    const { result } = handleResearch(game, {
      type: "research",
      player: "day",
      researchType: ResearchType.speed,
      castlePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects Mining III without Mining II", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.king("day")),
      2, 2, Building.castle("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleResearch(game, {
      type: "research",
      player: "day",
      researchType: ResearchType.miningIII,
      castlePosition: { row: 2, column: 2 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// ENTER TOWER TESTS
// ============================================

describe("handleEnterTower", () => {
  it("transforms tower into castle when king enters", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.king("day")),
      2, 3, Building.tower("day"),
    );
    const game = makeGame({ tiles });

    const { game: after, result } = handleEnterTower(game, {
      type: "enterTower",
      player: "day",
      kingPosition: { row: 2, column: 2 },
      towerPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(true);
    const towerTile = after.tiles.find((t) => t.row === 2 && t.column === 3);
    expect(towerTile?.building?.type).toBe(BuildingType.castle);
    expect(towerTile?.piece?.kind).toBe(PieceKind.king);

    const kingOrigin = after.tiles.find((t) => t.row === 2 && t.column === 2);
    expect(kingOrigin?.piece).toBeNull();
  });

  it("rejects non-king entering tower", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 3, Building.tower("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleEnterTower(game, {
      type: "enterTower",
      player: "day",
      kingPosition: { row: 2, column: 2 },
      towerPosition: { row: 2, column: 3 },
    });

    expect(result.success).toBe(false);
  });

  it("rejects entering non-adjacent tower", () => {
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 0, 0, Piece.king("day")),
      4, 4, Building.tower("day"),
    );
    const game = makeGame({ tiles });

    const { result } = handleEnterTower(game, {
      type: "enterTower",
      player: "day",
      kingPosition: { row: 0, column: 0 },
      towerPosition: { row: 4, column: 4 },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================
// ATTACK TESTS
// ============================================

describe("handleAttack", () => {
  it("peasant kills enemy peasant", () => {
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 3, Piece.peasant("night"),
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
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 3, Building.house("night"),
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
    const swordsman = Piece.peasant("day").withEquipment(Equipment.sword());
    const tiles = placeBuilding(
      placePiece(make5x5GrassTiles(), 2, 2, swordsman),
      2, 3, Building.house("night"),
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
      placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day")),
      2, 3, Piece.peasant("day"),
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
      placePiece(make5x5GrassTiles(), 0, 0, Piece.peasant("day")),
      4, 4, Piece.peasant("night"),
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
    const angel = Piece.archAngel("day"); // 3 attack > 1 defense
    const tiles = placeBuilding(
      placePiece(
        placePiece(make5x5GrassTiles(), 2, 2, angel),
        2, 3, Piece.king("night"),
      ),
      2, 3, Building.castle("night"),
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.king("night"));
    const game = makeGame({ tiles });

    const result = checkWinCondition(game);
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe("night");
  });

  it("day wins when night king is dead", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.king("day"));
    const game = makeGame({ tiles });

    const result = checkWinCondition(game);
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe("day");
  });

  it("game continues when both kings are alive", () => {
    const tiles = placePiece(
      placePiece(make5x5GrassTiles(), 2, 2, Piece.king("day")),
      3, 3, Piece.king("night"),
    );
    const game = makeGame({ tiles });

    const result = checkWinCondition(game);
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
    const tiles = placeBuilding(make5x5GrassTiles(), 2, 2, Building.church("day"));
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
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
    ] as const;
    const tilesWithChurches = positions.reduce(
      (acc, [row, col]) =>
        placeBuilding(
          placePiece(acc, row, col, Piece.priest("day")),
          row, col, Building.church("day"),
        ),
      baseTiles,
    );
    // Add an empty church for summoning
    const tiles = placeBuilding(tilesWithChurches, 2, 2, Building.church("day"));
    const game = makeGame({
      tiles,
      dayPlayer: new Player({
        type: "day",
        resources: new ResourceMap({ faith: 10 }), // not enough
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
  it("switches to night player when clock crosses 18:00", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
    const game = makeGame({
      tiles,
      clock: { time: 17, hasDawned: true, hasDusked: false },
    });

    const { game: after } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    // Clock goes from 17 to 18 = dusk
    expect(after.currentPlayer).toBe("night");
  });

  it("speed research reduces time per action", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
    const game = makeGame({
      tiles,
      dayPlayer: new Player({
        type: "day",
        resources: new ResourceMap({ wood: 50, stone: 50, iron: 50, gold: 50, food: 50, faith: 200 }),
        research: new Research({ speedLevel: 1 }), // 30 min per action
      }),
    });

    const { game: after } = handleMove(game, {
      type: "move",
      player: "day",
      from: { row: 2, column: 2 },
      to: { row: 2, column: 3 },
    });

    expect(after.clock.time).toBe(6.5); // 6 + 0.5 hours
  });
});

// ============================================
// ACTION DISPATCHER TESTS
// ============================================

describe("handleAction", () => {
  it("dispatches move action", () => {
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
    const tiles = placePiece(make5x5GrassTiles(), 2, 2, Piece.peasant("day"));
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
