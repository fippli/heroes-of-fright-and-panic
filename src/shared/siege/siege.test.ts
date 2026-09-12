import { describe, it, expect } from "vitest";
import type { Tile } from "@shared/map/tile.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import { BuildingType, createTowerBuilding, createWallBuilding } from "@shared/building/index.ts";
import { type Piece, createPeasant, createKing, pieceWithEquipment } from "@shared/piece/index.ts";
import { createBow, createSword, createShield } from "@shared/equipment/index.ts";
import { createPlayer } from "@shared/player/index.ts";
import { createResourceMap } from "@shared/player/resource-map.ts";
import { handleAttack } from "@shared/game/engine.ts";
import type { Game } from "@shared/game/types.ts";
import { hexDistance, findNeighbors } from "@shared/map/hex.ts";
import {
  MAX_DEFENDERS,
  SIEGE_FIELD_COLUMNS,
  SIEGE_FIELD_ROWS,
  applySiege,
  cutField,
  planSiege,
  resolveSiege,
  towerDefenderUnit,
  towerDefenders,
} from "./index.ts";

const SIZE = 20;

const grassMap = (): Tile[] =>
  Array.from({ length: SIZE * SIZE }, (_, index) => ({
    row: Math.floor(index / SIZE),
    column: index % SIZE,
    landscape: { type: LandscapeType.grass },
    piece: null,
    building: null,
  }));

const at = (tiles: ReadonlyArray<Tile>, row: number, column: number): Tile =>
  tiles.find((tile) => tile.row === row && tile.column === column)!;

const withPiece = (tiles: ReadonlyArray<Tile>, row: number, column: number, piece: Piece): Tile[] =>
  tiles.map((tile) => (tile.row === row && tile.column === column ? { ...tile, piece } : tile));

const withBuilding = (tiles: ReadonlyArray<Tile>, row: number, column: number, building: Tile["building"]): Tile[] =>
  tiles.map((tile) => (tile.row === row && tile.column === column ? { ...tile, building } : tile));

const swordsman = (owner: "day" | "night"): Piece =>
  pieceWithEquipment(pieceWithEquipment(createPeasant(owner), createSword()), createShield());

const TOWER = { row: 10, column: 10 };

/** A night watchtower at TOWER held by `held` pieces, with `storming` day peasants around it */
const siegeMap = (held: number, storming: number, level: number = 1): Tile[] => {
  const ring1 = findNeighbors(TOWER, grassMap());
  const withTower = withBuilding(grassMap(), TOWER.row, TOWER.column, createTowerBuilding("night", level));
  const defended = Array.from({ length: held }).reduce<Tile[]>((tiles, _, index) => {
    const spot = index === 0 ? TOWER : ring1[index - 1]!;
    return withPiece(tiles, spot.row, spot.column, swordsman("night"));
  }, withTower);
  // Attackers fill the free tiles next to the tower first, then the ring beyond
  const freeRing1 = ring1.filter((tile) => at(defended, tile.row, tile.column).piece === null);
  const ring2 = grassMap().filter((tile) => hexDistance(tile, TOWER) === 2);
  const spots = [...freeRing1, ...ring2];
  return Array.from({ length: storming }).reduce<Tile[]>((tiles, _, index) => {
    const spot = spots[index]!;
    return withPiece(tiles, spot.row, spot.column, swordsman("day"));
  }, defended);
};

/** The day piece nearest the tower: the one that swings first */
const firstAttackerPosition = (tiles: ReadonlyArray<Tile>) =>
  tiles
    .filter((tile) => tile.piece?.owner === "day")
    .toSorted((a, b) => hexDistance(a, TOWER) - hexDistance(b, TOWER))[0]!;

const makeGame = (tiles: ReadonlyArray<Tile>): Game => ({
  id: "siege-test",
  createdAt: new Date(),
  updatedAt: new Date(),
  size: SIZE,
  tiles,
  dayPlayer: createPlayer({ type: "day", resources: createResourceMap() }),
  nightPlayer: createPlayer({ type: "night", resources: createResourceMap() }),
  currentPlayer: "day",
  clock: { time: 6, hasDawned: true, hasDusked: false },
  creatorEmail: "test@test.com",
  gameOver: false,
  winner: null,
});

describe("siege planning", () => {
  it("is not a siege when the tower is undefended", () => {
    const tiles = siegeMap(0, 3);
    const from = firstAttackerPosition(tiles);
    expect(planSiege(tiles, from, TOWER, "day", "s")).toBeNull();
  });

  it("caps the garrison, keeping the piece on the tower and then the strongest", () => {
    const tiles = withPiece(siegeMap(5, 1), TOWER.row, TOWER.column, createPeasant("night"));
    const defenders = towerDefenders(tiles, TOWER, "night");
    expect(defenders).toHaveLength(MAX_DEFENDERS);
    expect(defenders[0]!.position).toEqual(TOWER);
    expect(defenders[0]!.piece.equipment).toHaveLength(0);
    defenders.slice(1).forEach((party) => expect(party.piece.equipment).toHaveLength(2));
  });

  it("gathers every attacker within reach that still has its action", () => {
    const spent = siegeMap(1, 6).map((tile) =>
      tile.piece?.owner === "day" && tile.row < TOWER.row ? { ...tile, piece: { ...tile.piece, acted: true } } : tile,
    );
    const from = firstAttackerPosition(spent);
    const plan = planSiege(spent, from, TOWER, "day", "s")!;
    const restedCount = spent.filter((tile) => tile.piece?.owner === "day" && tile.piece.acted !== true).length;
    expect(plan.attackers.length).toBe(restedCount + (from.piece?.acted === true ? 1 : 0));
    expect(plan.attackers[0]!.position).toEqual({ row: from.row, column: from.column });
  });

  it("cuts a field that keeps hex neighbours as neighbours and blocks walls", () => {
    const tiles = withBuilding(siegeMap(1, 1), TOWER.row, TOWER.column + 1, createWallBuilding("night"));
    const plan = planSiege(tiles, firstAttackerPosition(tiles), TOWER, "day", "s")!;
    expect(plan.battle.tiles).toHaveLength(SIEGE_FIELD_COLUMNS * SIEGE_FIELD_ROWS);
    expect(plan.origin.row % 2).toBe(0);
    const towerUnit = plan.battle.units.find((unit) => unit.id === "defender-0")!;
    const towerTile = plan.battle.tiles.find((tile) => tile.row === towerUnit.row && tile.column === towerUnit.column)!;
    expect(towerTile.building?.type).toBe(BuildingType.tower);
    const wallTile = plan.battle.tiles.find((tile) => tile.building?.type === BuildingType.wall)!;
    expect(hexDistance(wallTile, towerTile)).toBe(1);
    // Map neighbours stay neighbours on the field
    const mapNeighbours = findNeighbors(TOWER, tiles).length;
    expect(findNeighbors(towerTile, plan.battle.tiles as never[]).length).toBe(mapNeighbours);
    // The world's edge is water
    const edge = cutField(tiles, { row: 18, column: 18 });
    expect(edge.some((tile) => tile.landscape === LandscapeType.water)).toBe(true);
  });

  it("arms defenders with the tower: initiative, armour and bow range grow with level", () => {
    const archer = pieceWithEquipment(createPeasant("night"), createBow());
    const low = towerDefenderUnit(archer, 1, "a", TOWER);
    const high = towerDefenderUnit(archer, 3, "b", TOWER);
    expect(high.initiative).toBeGreaterThan(low.initiative);
    expect(high.piece.baseDefense).toBe(3);
    expect(low.attackRange).toBe(2);
    expect(high.attackRange).toBe(4);
  });
});

describe("siege resolution", () => {
  it("three behind walls hold off four, but not ten", () => {
    const few = siegeMap(3, 4);
    const fewPlan = planSiege(few, firstAttackerPosition(few), TOWER, "day", "seed")!;
    const fewOutcome = resolveSiege(fewPlan);
    expect(fewOutcome.towerFalls).toBe(false);

    const many = siegeMap(3, 10);
    const manyPlan = planSiege(many, firstAttackerPosition(many), TOWER, "day", "seed")!;
    const manyOutcome = resolveSiege(manyPlan);
    expect(manyOutcome.towerFalls).toBe(true);
    expect(manyOutcome.attackersLost).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed", () => {
    const tiles = siegeMap(3, 7);
    const from = firstAttackerPosition(tiles);
    const a = resolveSiege(planSiege(tiles, from, TOWER, "day", "same")!);
    const b = resolveSiege(planSiege(tiles, from, TOWER, "day", "same")!);
    expect(a.battle.log).toEqual(b.battle.log);
  });

  it("writes the outcome back: the dead vanish, attackers rest, defenders shed the wall armour, a taken tower crumbles", () => {
    const tiles = siegeMap(3, 10, 2);
    const from = firstAttackerPosition(tiles);
    const outcome = resolveSiege(planSiege(tiles, from, TOWER, "day", "seed")!);
    const after = applySiege(tiles, outcome);

    const before = tiles.filter((tile) => tile.piece !== null).length;
    const remaining = after.filter((tile) => tile.piece !== null).length;
    expect(before - remaining).toBe(outcome.attackersLost + outcome.defendersLost);
    after
      .filter((tile) => tile.piece?.owner === "day")
      .forEach((tile) => expect(tile.piece?.acted).toBe(true));
    after
      .filter((tile) => tile.piece?.owner === "night")
      .forEach((tile) => expect(tile.piece!.baseDefense).toBeLessThanOrEqual(1));
    expect(at(after, TOWER.row, TOWER.column).building).toBe(outcome.towerFalls ? null : at(tiles, TOWER.row, TOWER.column).building);
  });

  it("a held tower keeps its defenders' remaining hearts and the building", () => {
    const tiles = siegeMap(3, 2);
    const outcome = resolveSiege(planSiege(tiles, firstAttackerPosition(tiles), TOWER, "day", "seed")!);
    expect(outcome.towerFalls).toBe(false);
    const after = applySiege(tiles, outcome);
    expect(at(after, TOWER.row, TOWER.column).building?.type).toBe(BuildingType.tower);
  });
});

describe("attacking a tower on the overworld", () => {
  it("storms a defended tower with everyone nearby and reports the siege", () => {
    const tiles = siegeMap(3, 10);
    const from = firstAttackerPosition(tiles);
    const { game, result } = handleAttack(makeGame(tiles), {
      type: "attack",
      player: "day",
      attackerPosition: { row: from.row, column: from.column },
      targetPosition: TOWER,
    });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/^Siege: 10 stormed the Watchpost held by 3/);
    expect(at(game.tiles, TOWER.row, TOWER.column).building).toBeNull();
    game.tiles.filter((tile) => tile.piece?.owner === "day").forEach((tile) => expect(tile.piece?.acted).toBe(true));
  });

  it("still needs a real blow against an undefended tower", () => {
    const tiles = siegeMap(0, 1);
    const from = firstAttackerPosition(tiles);
    const { game, result } = handleAttack(makeGame(tiles), {
      type: "attack",
      player: "day",
      attackerPosition: { row: from.row, column: from.column },
      targetPosition: TOWER,
    });
    expect(result.success).toBe(true);
    expect(result.message).not.toMatch(/^Siege/);
    // A sword (2 attack) beats the watchpost's 1 defense
    expect(at(game.tiles, TOWER.row, TOWER.column).building).toBeNull();
  });

  it("a fallen king in the storm ends the game", () => {
    const base = siegeMap(3, 1);
    const from = firstAttackerPosition(base);
    const tiles = withPiece(base, from.row, from.column, createKing("day"));
    const { game } = handleAttack(makeGame(tiles), {
      type: "attack",
      player: "day",
      attackerPosition: { row: from.row, column: from.column },
      targetPosition: TOWER,
    });
    const kingLives = game.tiles.some((tile) => tile.piece?.kind === "king" && tile.piece.owner === "day");
    expect(game.gameOver).toBe(!kingLives);
  });
});
