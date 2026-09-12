/**
 * Tower sieges — the overworld's battle mode.
 *
 * Attacking an enemy tower that has defenders nearby does not resolve as a
 * single blow. Instead every attacker within reach of the tower storms it
 * together against at most MAX_DEFENDERS pieces holding it, on a field cut
 * straight from the map around the tower. The fight is played out by the
 * battle engine with the AI on both sides from a fixed seed, so the server
 * and a client forecast reach the same result.
 *
 * The tower's advantage: its defenders act first, wear its walls as armour,
 * and bows behind them shoot as far as the tower sees. All of it grows with
 * the tower's level. Attackers therefore need numbers.
 */

import { BuildingType, buildingLevel, TOWER_LEVEL_NAMES } from "@shared/building/index.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import { hexDistance } from "@shared/map/hex.ts";
import type { Tile, TilePosition } from "@shared/map/tile.ts";
import { findTile, replaceTile } from "@shared/tile/index.ts";
import {
  type Piece,
  type PlayerType,
  getPieceAttackRange,
  getPieceAttack,
  getPieceDefense,
  pieceHasEquipment,
} from "@shared/piece/index.ts";
import { EquipmentType } from "@shared/equipment/index.ts";
import {
  type BattleState,
  type BattleTile,
  type BattleUnit,
  createBattleOnField,
  initiativeOf,
  runBattle,
} from "@shared/battle/index.ts";

/** Attackers this close to the tower join the storm */
export const SIEGE_RANGE = 2;
/** The tower can be held by this many pieces at most */
export const MAX_DEFENDERS = 3;
/** Rounds before an assault that has not taken the tower breaks off */
export const SIEGE_MAX_ROUNDS = 30;
export const SIEGE_FIELD_COLUMNS = 15;
export const SIEGE_FIELD_ROWS = 9;

export type SiegeParty = {
  readonly position: TilePosition;
  readonly piece: Piece;
};

export type SiegePlan = {
  readonly tower: TilePosition;
  readonly towerLevel: number;
  readonly attacker: PlayerType;
  readonly defender: PlayerType;
  readonly attackers: ReadonlyArray<SiegeParty>;
  readonly defenders: ReadonlyArray<SiegeParty>;
  /** Map position of the field's top-left tile */
  readonly origin: TilePosition;
  readonly battle: BattleState;
};

export type SiegeOutcome = {
  readonly plan: SiegePlan;
  readonly battle: BattleState;
  readonly towerFalls: boolean;
  readonly attackersLost: number;
  readonly defendersLost: number;
};

const hasSpentAction = (piece: Piece): boolean => piece.acted === true || (piece.stepsTaken ?? 0) > 0;

const strength = (piece: Piece): number => getPieceAttack(piece) * 2 + getPieceDefense(piece) + piece.hearts;

/** The piece as it fights from behind the tower's walls */
export const towerDefenderUnit = (
  piece: Piece,
  towerLevel: number,
  id: string,
  position: TilePosition,
): BattleUnit => {
  const towerRange = 1 + towerLevel;
  const bow = pieceHasEquipment(piece, EquipmentType.bow);
  const armoured: Piece = { ...piece, baseDefense: piece.baseDefense + towerLevel };
  return {
    id,
    owner: piece.owner,
    piece: armoured,
    row: position.row,
    column: position.column,
    initiative: initiativeOf(piece) + 3 + towerLevel,
    attackRange: bow ? Math.max(getPieceAttackRange(piece), towerRange) : getPieceAttackRange(piece),
    moved: false,
    done: false,
  };
};

/** The piece back on the map: whatever of the wall armour it did not lose comes off again */
const withoutTowerArmour = (piece: Piece, towerLevel: number): Piece => ({
  ...piece,
  baseDefense: Math.max(0, piece.baseDefense - towerLevel),
});

export const attackerUnit = (piece: Piece, id: string, position: TilePosition): BattleUnit => ({
  id,
  owner: piece.owner,
  piece,
  row: position.row,
  column: position.column,
  initiative: initiativeOf(piece),
  attackRange: getPieceAttackRange(piece),
  moved: false,
  done: false,
});

/** Top-left map position of the field around the tower; the row offset stays even so hex parity survives */
const fieldOrigin = (tower: TilePosition): TilePosition => {
  const half = Math.floor(SIEGE_FIELD_ROWS / 2);
  const wantedRow = tower.row - half;
  return {
    row: wantedRow % 2 === 0 ? wantedRow : wantedRow - 1,
    column: tower.column - Math.floor(SIEGE_FIELD_COLUMNS / 2),
  };
};

const toLocal = (origin: TilePosition, position: TilePosition): TilePosition => ({
  row: position.row - origin.row,
  column: position.column - origin.column,
});

const toWorld = (origin: TilePosition, position: TilePosition): TilePosition => ({
  row: position.row + origin.row,
  column: position.column + origin.column,
});

/** The map around the tower as a battlefield: unknown ground counts as grass, beyond the map as water */
export const cutField = (tiles: ReadonlyArray<Tile>, origin: TilePosition): ReadonlyArray<BattleTile> =>
  Array.from({ length: SIEGE_FIELD_ROWS * SIEGE_FIELD_COLUMNS }, (_, index) => {
    const local = { row: Math.floor(index / SIEGE_FIELD_COLUMNS), column: index % SIEGE_FIELD_COLUMNS };
    const tile = findTile(tiles, toWorld(origin, local));
    if (tile === undefined) return { ...local, landscape: LandscapeType.water };
    const type = tile.landscape?.type;
    const landscape = type === undefined || type === LandscapeType.unexplored ? LandscapeType.grass : type;
    const building =
      tile.building === null
        ? undefined
        : { type: tile.building.type, owner: tile.building.owner, level: buildingLevel(tile.building) };
    return building === undefined ? { ...local, landscape } : { ...local, landscape, building };
  });

/** Who holds the tower: the piece on it first, then the strongest neighbours, at most MAX_DEFENDERS */
export const towerDefenders = (
  tiles: ReadonlyArray<Tile>,
  tower: TilePosition,
  defender: PlayerType,
): ReadonlyArray<SiegeParty> =>
  tiles
    .filter((tile) => tile.piece !== null && tile.piece.owner === defender && hexDistance(tile, tower) <= 1)
    .map((tile) => ({ position: { row: tile.row, column: tile.column }, piece: tile.piece! }))
    .toSorted((a, b) => {
      const onTowerA = hexDistance(a.position, tower) === 0 ? 1 : 0;
      const onTowerB = hexDistance(b.position, tower) === 0 ? 1 : 0;
      return onTowerB - onTowerA || strength(b.piece) - strength(a.piece);
    })
    .slice(0, MAX_DEFENDERS);

/** Every attacker piece near the tower that still has its action this phase, the one striking first */
export const siegeAttackers = (
  tiles: ReadonlyArray<Tile>,
  attackerPosition: TilePosition,
  tower: TilePosition,
  attacker: PlayerType,
): ReadonlyArray<SiegeParty> =>
  tiles
    .filter(
      (tile) =>
        tile.piece !== null &&
        tile.piece.owner === attacker &&
        hexDistance(tile, tower) <= SIEGE_RANGE &&
        (hexDistance(tile, attackerPosition) === 0 || !hasSpentAction(tile.piece)),
    )
    .map((tile) => ({ position: { row: tile.row, column: tile.column }, piece: tile.piece! }))
    .toSorted((a, b) => hexDistance(a.position, attackerPosition) - hexDistance(b.position, attackerPosition));

export const towerName = (level: number): string => TOWER_LEVEL_NAMES[level] ?? "Tower";

/**
 * Lay out the siege an attack on `tower` would start, or null when the tower
 * is undefended (a plain attack on the building then applies).
 */
export const planSiege = (
  tiles: ReadonlyArray<Tile>,
  attackerPosition: TilePosition,
  tower: TilePosition,
  attacker: PlayerType,
  seed: string,
): SiegePlan | null => {
  const towerTile = findTile(tiles, tower);
  if (towerTile === undefined || towerTile.building === null) return null;
  if (towerTile.building.type !== BuildingType.tower || towerTile.building.owner === attacker) return null;
  const defender = towerTile.building.owner;
  const defenders = towerDefenders(tiles, tower, defender);
  if (defenders.length === 0) return null;
  const attackers = siegeAttackers(tiles, attackerPosition, tower, attacker);
  if (attackers.length === 0) return null;

  const towerLevel = buildingLevel(towerTile.building);
  const origin = fieldOrigin(tower);
  const units: ReadonlyArray<BattleUnit> = [
    ...attackers.map((party, index) => attackerUnit(party.piece, `attacker-${index}`, toLocal(origin, party.position))),
    ...defenders.map((party, index) =>
      towerDefenderUnit(party.piece, towerLevel, `defender-${index}`, toLocal(origin, party.position)),
    ),
  ];
  const battle = createBattleOnField({
    seed,
    columns: SIEGE_FIELD_COLUMNS,
    rows: SIEGE_FIELD_ROWS,
    tiles: cutField(tiles, origin),
    units,
    opening: `${attackers.length} storm the ${towerName(towerLevel)} held by ${defenders.length}`,
    maxRounds: SIEGE_MAX_ROUNDS,
    stalemateWinner: defender,
    hold: { owner: defender, around: toLocal(origin, tower), radius: 1 },
  });
  return { tower, towerLevel, attacker, defender, attackers, defenders, origin, battle };
};

export const resolveSiege = (plan: SiegePlan): SiegeOutcome => {
  const battle = runBattle(plan.battle);
  const fallen = (owner: PlayerType) => battle.units.filter((unit) => unit.owner === owner && unit.piece.hearts <= 0).length;
  return {
    plan,
    battle,
    towerFalls: battle.winner === plan.attacker,
    attackersLost: fallen(plan.attacker),
    defendersLost: fallen(plan.defender),
  };
};

/** Carry the outcome back onto the map: the dead vanish, survivors keep their wounds, a taken tower crumbles */
export const applySiege = (tiles: ReadonlyArray<Tile>, outcome: SiegeOutcome): ReadonlyArray<Tile> => {
  const { plan, battle } = outcome;
  // Units fought across the field, but on the map each stays on the tile it stormed from
  const homeOf = (unit: BattleUnit): TilePosition | undefined => {
    const [side, indexText] = unit.id.split("-");
    const index = Number(indexText);
    return side === "attacker" ? plan.attackers[index]?.position : plan.defenders[index]?.position;
  };
  const afterUnits = battle.units.reduce<ReadonlyArray<Tile>>((current, unit) => {
    const position = homeOf(unit);
    const tile = position === undefined ? undefined : findTile(current, position);
    if (tile === undefined) return current;
    if (unit.piece.hearts <= 0) return replaceTile(current, { ...tile, piece: null });
    const piece =
      unit.owner === plan.defender
        ? withoutTowerArmour(unit.piece, plan.towerLevel)
        : { ...unit.piece, acted: true };
    return replaceTile(current, { ...tile, piece });
  }, tiles);
  if (!outcome.towerFalls) return afterUnits;
  const towerTile = findTile(afterUnits, plan.tower);
  return towerTile === undefined ? afterUnits : replaceTile(afterUnits, { ...towerTile, building: null });
};

export const describeSiege = (outcome: SiegeOutcome): string => {
  const { plan } = outcome;
  const tower = towerName(plan.towerLevel);
  const verdict = outcome.towerFalls ? `the ${tower} falls` : `the ${tower} holds`;
  return `Siege: ${plan.attackers.length} stormed the ${tower} held by ${plan.defenders.length} — ${verdict} (${outcome.attackersLost} attackers and ${outcome.defendersLost} defenders slain)`;
};

/** One seed per tower and hour, so a forecast and the server agree */
export const siegeSeed = (gameId: string, tower: TilePosition, hour: number): string =>
  `siege:${gameId}:${tower.row},${tower.column}:${hour}`;

