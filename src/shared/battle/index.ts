/**
 * Battle engine — a self-contained tactical fight on a small hex field.
 *
 * Pure functions over an immutable BattleState so the same rules can run in
 * the sandbox, in tests, and later as the siege screen of the real game.
 *
 * Rules:
 * - Units act one at a time in initiative order (fast units first); a round
 *   ends when every living unit has had its turn.
 * - On its turn a unit may move once (up to its Move stat through walkable,
 *   unoccupied tiles) and then take one action: attack an enemy within its
 *   attack range, or (priests) heal an adjacent wounded ally. Any action ends
 *   the turn; a unit may also wait.
 * - Damage follows the overworld rules: defense absorbs first and is lost
 *   permanently, then hearts.
 * - A side loses when its king dies or when it has no living units left.
 */

import { LandscapeType } from "@shared/map/landscape.ts";
import { BuildingType } from "@shared/building/index.ts";
import { findNeighbors, hexDistance } from "@shared/map/hex.ts";
import type { TilePosition } from "@shared/map/tile.ts";
import {
  type Piece,
  PieceKind,
  type PlayerType,
  createPeasant,
  createKing,
  createPriest,
  createArchAngel,
  getPieceAttack,
  getPieceAttackRange,
  getPieceDefense,
  getPieceMove,
  getWalkableLandscape,
  pieceWithDamage,
  pieceWithEquipment,
  pieceWithHealing,
  pieceHasEquipment,
} from "@shared/piece/index.ts";
import { EquipmentType, createEquipment } from "@shared/equipment/index.ts";
import { SteedType, createSteed } from "@shared/steed/index.ts";
import { createRandom, type RandomFunction } from "@shared/utils/random.ts";

// ============================================
// TYPES
// ============================================

export type BattleBuilding = {
  readonly type: BuildingType;
  readonly owner: PlayerType;
  readonly level: number;
};

export type BattleTile = TilePosition & {
  readonly landscape: LandscapeType;
  /** Building standing here on the overworld; walls block movement */
  readonly building?: BattleBuilding;
};

export type BattleUnit = TilePosition & {
  readonly id: string;
  readonly owner: PlayerType;
  readonly piece: Piece;
  /** Turn order weight: higher acts earlier in each round */
  readonly initiative: number;
  /** Reach of its attacks; a bow behind tower walls shoots as far as the tower sees */
  readonly attackRange: number;
  /** Whether the unit has moved this turn */
  readonly moved: boolean;
  /** Whether the unit has finished its turn this round */
  readonly done: boolean;
};

export type BattleEvent =
  | { readonly type: "move"; readonly unitId: string; readonly from: TilePosition; readonly to: TilePosition }
  | { readonly type: "attack"; readonly unitId: string; readonly targetId: string; readonly damage: number; readonly destroyed: boolean }
  | { readonly type: "heal"; readonly unitId: string; readonly targetId: string }
  | { readonly type: "wait"; readonly unitId: string }
  | { readonly type: "round"; readonly round: number }
  | { readonly type: "victory"; readonly winner: PlayerType };

export type BattleState = {
  readonly seed: string;
  readonly columns: number;
  readonly rows: number;
  readonly tiles: ReadonlyArray<BattleTile>;
  readonly units: ReadonlyArray<BattleUnit>;
  /** Living unit ids in the order they act this round */
  readonly order: ReadonlyArray<string>;
  readonly turnIndex: number;
  readonly round: number;
  /** Rounds after which the fight is called; null fights to the end */
  readonly maxRounds: number | null;
  /** Who is left standing when the round cap is reached (the side that holds the ground) */
  readonly stalemateWinner: PlayerType | null;
  /** A garrison keeps to its post: this side's AI never strays beyond `radius` of `around` */
  readonly hold: HoldOrder | null;
  readonly log: ReadonlyArray<string>;
  readonly events: ReadonlyArray<BattleEvent>;
  readonly winner: PlayerType | null;
};

export type HoldOrder = {
  readonly owner: PlayerType;
  readonly around: TilePosition;
  readonly radius: number;
};

export type BattleAction =
  | { readonly type: "move"; readonly to: TilePosition }
  | { readonly type: "attack"; readonly targetId: string }
  | { readonly type: "heal"; readonly targetId: string }
  | { readonly type: "wait" };

// ============================================
// ARMIES
// ============================================

export type UnitSpec = {
  readonly kind: PieceKind;
  readonly equipment?: ReadonlyArray<EquipmentType>;
  readonly steed?: SteedType;
};

export type ArmyPreset = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly units: ReadonlyArray<UnitSpec>;
};

const peasant = (equipment: ReadonlyArray<EquipmentType> = [], steed?: SteedType): UnitSpec => ({
  kind: PieceKind.peasant,
  equipment,
  steed,
});

export const ARMY_PRESETS: ReadonlyArray<ArmyPreset> = [
  {
    id: "levy",
    name: "Levy",
    description: "A king and five unarmed peasants.",
    units: [{ kind: PieceKind.king }, peasant(), peasant(), peasant(), peasant(), peasant()],
  },
  {
    id: "men-at-arms",
    name: "Men-at-arms",
    description: "Sword and shield in front, two bows behind.",
    units: [
      { kind: PieceKind.king },
      peasant([EquipmentType.sword, EquipmentType.shield]),
      peasant([EquipmentType.sword, EquipmentType.shield]),
      peasant([EquipmentType.sword, EquipmentType.shield]),
      peasant([EquipmentType.bow]),
      peasant([EquipmentType.bow]),
    ],
  },
  {
    id: "riders",
    name: "Riders",
    description: "Everyone mounted, swords drawn.",
    units: [
      { kind: PieceKind.king, steed: SteedType.horse },
      peasant([EquipmentType.sword], SteedType.horse),
      peasant([EquipmentType.sword], SteedType.horse),
      peasant([EquipmentType.sword], SteedType.horse),
      peasant([EquipmentType.sword], SteedType.horse),
    ],
  },
  {
    id: "archers",
    name: "Archers",
    description: "Two shield bearers screening four bows.",
    units: [
      { kind: PieceKind.king },
      peasant([EquipmentType.shield]),
      peasant([EquipmentType.shield]),
      peasant([EquipmentType.bow]),
      peasant([EquipmentType.bow]),
      peasant([EquipmentType.bow]),
      peasant([EquipmentType.bow]),
    ],
  },
  {
    id: "host",
    name: "Royal host",
    description: "Armoured swords, mounted bows and a priest with the king.",
    units: [
      { kind: PieceKind.king },
      { kind: PieceKind.priest },
      peasant([EquipmentType.sword, EquipmentType.helmet, EquipmentType.torso]),
      peasant([EquipmentType.sword, EquipmentType.helmet, EquipmentType.torso]),
      peasant([EquipmentType.bow], SteedType.horse),
      peasant([EquipmentType.bow], SteedType.horse),
      peasant([EquipmentType.shield]),
    ],
  },
  {
    id: "angelic",
    name: "Angelic",
    description: "An archangel with a thin escort.",
    units: [{ kind: PieceKind.king }, { kind: PieceKind.archAngel }, peasant([EquipmentType.shield]), peasant([EquipmentType.shield])],
  },
  {
    id: "horde",
    name: "Horde",
    description: "Ten peasants with whatever was in the armoury.",
    units: [
      { kind: PieceKind.king },
      peasant([EquipmentType.sword, EquipmentType.shield]),
      peasant([EquipmentType.sword, EquipmentType.shield]),
      peasant([EquipmentType.sword]),
      peasant([EquipmentType.sword]),
      peasant([EquipmentType.sword], SteedType.horse),
      peasant([EquipmentType.bow]),
      peasant([EquipmentType.bow]),
      peasant([EquipmentType.shield]),
      peasant(),
      peasant(),
    ],
  },
];

export const findArmyPreset = (id: string): ArmyPreset =>
  ARMY_PRESETS.find((preset) => preset.id === id) ?? ARMY_PRESETS[0]!;

const createBasePiece = (kind: PieceKind, owner: PlayerType): Piece => {
  switch (kind) {
    case PieceKind.king:
      return createKing(owner);
    case PieceKind.priest:
      return createPriest(owner);
    case PieceKind.archAngel:
      return createArchAngel(owner);
    case PieceKind.peasant:
      return createPeasant(owner);
  }
};

export const createPieceFromSpec = (spec: UnitSpec, owner: PlayerType): Piece => {
  const base = createBasePiece(spec.kind, owner);
  const equipped = (spec.equipment ?? []).reduce(
    (piece, item) => pieceWithEquipment(piece, createEquipment(item)),
    base,
  );
  return spec.steed === undefined ? equipped : { ...equipped, steed: createSteed(spec.steed) };
};

// ============================================
// INITIATIVE
// ============================================

const BASE_INITIATIVE: Record<PieceKind, number> = {
  [PieceKind.archAngel]: 10,
  [PieceKind.king]: 6,
  [PieceKind.priest]: 5,
  [PieceKind.peasant]: 4,
};

/** Fast and light acts first: horses add, heavy armour drags */
export const initiativeOf = (piece: Piece): number => {
  const mounted = piece.steed !== null ? 2 : 0;
  const armour = pieceHasEquipment(piece, EquipmentType.torso) ? 1 : 0;
  return BASE_INITIATIVE[piece.kind] + mounted - armour;
};

// ============================================
// BATTLEFIELD GENERATION
// ============================================

export const BATTLEFIELD_COLUMNS = 15;
export const BATTLEFIELD_ROWS = 9;
/** Columns on each edge kept clear of terrain so armies always fit */
const DEPLOY_WIDTH = 2;

const tileKey = (position: TilePosition): string => `${position.row},${position.column}`;

const isDeployColumn = (column: number, columns: number): boolean =>
  column < DEPLOY_WIDTH || column >= columns - DEPLOY_WIDTH;

/**
 * A meadow with copses of trees, a few boulders, and sometimes a stream
 * across the middle with a couple of fords.
 */
export const generateBattlefield = (
  seed: string,
  columns: number = BATTLEFIELD_COLUMNS,
  rows: number = BATTLEFIELD_ROWS,
): ReadonlyArray<BattleTile> => {
  const random = createRandom(`battle:${seed}`);
  const landscape = new Map<string, LandscapeType>();
  const positions: TilePosition[] = Array.from({ length: rows * columns }, (_, index) => ({
    row: Math.floor(index / columns),
    column: index % columns,
  }));
  positions.forEach((position) => landscape.set(tileKey(position), LandscapeType.grass));

  const paint = (position: TilePosition, type: LandscapeType) => {
    if (position.row < 0 || position.row >= rows) return;
    if (isDeployColumn(position.column, columns)) return;
    landscape.set(tileKey(position), type);
  };

  // Copses: seeds of trees that spread to some neighbours
  const copses = 3 + Math.floor(random() * 3);
  Array.from({ length: copses }).forEach(() => {
    const origin = {
      row: Math.floor(random() * rows),
      column: DEPLOY_WIDTH + Math.floor(random() * (columns - DEPLOY_WIDTH * 2)),
    };
    paint(origin, LandscapeType.tree);
    findNeighbors(origin, positions).forEach((neighbor) => {
      if (random() < 0.45) paint(neighbor, LandscapeType.tree);
    });
  });

  // Boulders
  const boulders = 1 + Math.floor(random() * 3);
  Array.from({ length: boulders }).forEach(() => {
    paint(
      { row: Math.floor(random() * rows), column: DEPLOY_WIDTH + Math.floor(random() * (columns - DEPLOY_WIDTH * 2)) },
      LandscapeType.mountain,
    );
  });

  // A stream down the middle, wandering one column either way, with fords
  if (random() < 0.5) {
    const middle = Math.floor(columns / 2);
    const fordA = Math.floor(random() * rows);
    const fordB = (fordA + 3 + Math.floor(random() * (rows - 5))) % rows;
    let column = middle;
    Array.from({ length: rows }).forEach((_, row) => {
      const drift = random();
      column = Math.max(middle - 1, Math.min(middle + 1, column + (drift < 0.3 ? -1 : drift > 0.7 ? 1 : 0)));
      const type = row === fordA || row === fordB ? LandscapeType.sand : LandscapeType.water;
      paint({ row, column }, type);
    });
  }

  // No pockets: every walkable tile must connect to both deployment edges.
  // Enclosed clearings become forest; a walled-off far edge gets a path cut through.
  const walkable = (position: TilePosition): boolean => {
    const type = landscape.get(tileKey(position));
    return type === LandscapeType.grass || type === LandscapeType.sand;
  };
  const reachedFrom = (start: TilePosition): Set<string> => {
    const seen = new Set<string>([tileKey(start)]);
    const frontier: TilePosition[] = [start];
    while (frontier.length > 0) {
      const current = frontier.shift()!;
      findNeighbors(current, positions).forEach((neighbor) => {
        const key = tileKey(neighbor);
        if (seen.has(key) || !walkable(neighbor)) return;
        seen.add(key);
        frontier.push(neighbor);
      });
    }
    return seen;
  };
  const farEdge = { row: 0, column: columns - 1 };
  for (let attempt = 0; attempt < columns * rows; attempt += 1) {
    const reached = reachedFrom({ row: 0, column: 0 });
    if (reached.has(tileKey(farEdge))) break;
    // Open the blocking tile closest to the far edge that touches the reached region
    const frontier = positions
      .filter((position) => !walkable(position) && findNeighbors(position, positions).some((neighbor) => reached.has(tileKey(neighbor))))
      .toSorted((a, b) => b.column - a.column || random() - 0.5);
    const gap = frontier[0];
    if (gap === undefined) break;
    landscape.set(tileKey(gap), landscape.get(tileKey(gap)) === LandscapeType.water ? LandscapeType.sand : LandscapeType.grass);
  }
  const connected = reachedFrom({ row: 0, column: 0 });
  positions.forEach((position) => {
    if (walkable(position) && !connected.has(tileKey(position))) {
      landscape.set(tileKey(position), LandscapeType.tree);
    }
  });

  return positions.map((position) => ({
    ...position,
    landscape: landscape.get(tileKey(position)) ?? LandscapeType.grass,
  }));
};

// ============================================
// SETUP
// ============================================

export type BattleSetup = {
  readonly seed: string;
  readonly day: ArmyPreset;
  readonly night: ArmyPreset;
  readonly columns?: number;
  readonly rows?: number;
};

/** Rows for a column of `count` units, centred on the field */
const deploymentRows = (count: number, rows: number): ReadonlyArray<number> => {
  const start = Math.floor((rows - count) / 2);
  return Array.from({ length: count }, (_, index) => start + index);
};

/** Line an army up along its edge of the field: king at the back, the rest in front */
export const deployArmy = (
  preset: ArmyPreset,
  owner: PlayerType,
  columns: number,
  rows: number,
): ReadonlyArray<BattleUnit> => {
  // King in the back column, the rest in front of him; overflow spills to the king's column
  const front = preset.units.filter((spec) => spec.kind !== PieceKind.king);
  const back = preset.units.filter((spec) => spec.kind === PieceKind.king);
  const frontCapacity = rows;
  const frontLine = front.slice(0, frontCapacity);
  const backLine = [...back, ...front.slice(frontCapacity)];
  const backColumn = owner === "day" ? 0 : columns - 1;
  const frontColumn = owner === "day" ? 1 : columns - 2;

  const place = (specs: ReadonlyArray<UnitSpec>, column: number, label: string): ReadonlyArray<BattleUnit> =>
    deploymentRows(specs.length, rows).map((row, index) => {
      const spec = specs[index]!;
      const piece = createPieceFromSpec(spec, owner);
      return {
        id: `${owner}-${label}-${index}`,
        owner,
        piece,
        row,
        column,
        initiative: initiativeOf(piece),
        attackRange: getPieceAttackRange(piece),
        moved: false,
        done: false,
      };
    });

  return [...place(backLine, backColumn, "back"), ...place(frontLine, frontColumn, "front")];
};

const computeOrder = (units: ReadonlyArray<BattleUnit>, random: RandomFunction): ReadonlyArray<string> => {
  const roll = new Map(units.map((unit) => [unit.id, random()]));
  return units
    .filter((unit) => unit.piece.hearts > 0)
    .toSorted((a, b) => b.initiative - a.initiative || (roll.get(a.id) ?? 0) - (roll.get(b.id) ?? 0))
    .map((unit) => unit.id);
};

const orderRandom = (seed: string, round: number): RandomFunction => createRandom(`order:${seed}:${round}`);

export type FieldSetup = {
  readonly seed: string;
  readonly columns: number;
  readonly rows: number;
  readonly tiles: ReadonlyArray<BattleTile>;
  readonly units: ReadonlyArray<BattleUnit>;
  readonly opening: string;
  readonly maxRounds?: number;
  readonly stalemateWinner?: PlayerType;
  readonly hold?: HoldOrder;
};

/** A battle on a prepared field with units already in position */
export const createBattleOnField = (setup: FieldSetup): BattleState => ({
  seed: setup.seed,
  columns: setup.columns,
  rows: setup.rows,
  tiles: setup.tiles,
  units: setup.units,
  order: computeOrder(setup.units, orderRandom(setup.seed, 1)),
  turnIndex: 0,
  round: 1,
  maxRounds: setup.maxRounds ?? null,
  stalemateWinner: setup.stalemateWinner ?? null,
  hold: setup.hold ?? null,
  log: [`Round 1 — ${setup.opening}`],
  events: [{ type: "round", round: 1 }],
  winner: null,
});

export const createBattle = (setup: BattleSetup): BattleState => {
  const columns = setup.columns ?? BATTLEFIELD_COLUMNS;
  const rows = setup.rows ?? BATTLEFIELD_ROWS;
  return createBattleOnField({
    seed: setup.seed,
    columns,
    rows,
    tiles: generateBattlefield(setup.seed, columns, rows),
    units: [...deployArmy(setup.day, "day", columns, rows), ...deployArmy(setup.night, "night", columns, rows)],
    opening: `${setup.day.name} (day) against ${setup.night.name} (night)`,
  });
};

/** Play the battle out with the AI on both sides */
export const runBattle = (start: BattleState, maxSteps: number = 5000): BattleState => {
  let state = start;
  for (let step = 0; step < maxSteps && state.winner === null; step += 1) {
    const result = applyBattleAction(state, chooseBattleAction(state));
    if (!result.ok) break;
    state = result.state;
  }
  return state;
};

// ============================================
// QUERIES
// ============================================

export const findUnit = (state: BattleState, unitId: string): BattleUnit | null =>
  state.units.find((unit) => unit.id === unitId) ?? null;

export const isUnitAlive = (unit: BattleUnit): boolean => unit.piece.hearts > 0;

export const livingUnits = (state: BattleState): ReadonlyArray<BattleUnit> => state.units.filter(isUnitAlive);

export const unitAt = (state: BattleState, position: TilePosition): BattleUnit | null =>
  livingUnits(state).find((unit) => unit.row === position.row && unit.column === position.column) ?? null;

export const activeUnit = (state: BattleState): BattleUnit | null => {
  if (state.winner !== null) return null;
  const id = state.order[state.turnIndex];
  if (id === undefined) return null;
  const unit = findUnit(state, id);
  return unit !== null && isUnitAlive(unit) ? unit : null;
};

export const describeUnit = (unit: BattleUnit): string => {
  const kind = unit.piece.kind === PieceKind.archAngel ? "archangel" : unit.piece.kind;
  const gear = [
    ...unit.piece.equipment.map((item) => item.type),
    ...(unit.piece.steed !== null ? [unit.piece.steed.type] : []),
  ];
  return gear.length === 0 ? kind : `${kind} (${gear.join(", ")})`;
};

const canWalk = (unit: BattleUnit, tile: BattleTile): boolean =>
  getWalkableLandscape(unit.piece).includes(tile.landscape) && tile.building?.type !== BuildingType.wall;

export type ReachableTile = TilePosition & { readonly distance: number };

/** Tiles the unit could move to this turn (empty, walkable, within Move steps) */
export const reachableTiles = (state: BattleState, unit: BattleUnit): ReadonlyArray<ReachableTile> => {
  if (unit.moved || !isUnitAlive(unit)) return [];
  const range = getPieceMove(unit.piece);
  const occupied = new Set(livingUnits(state).map(tileKey));
  const tilesByKey = new Map(state.tiles.map((tile) => [tileKey(tile), tile]));
  const visited = new Map<string, number>([[tileKey(unit), 0]]);
  const frontier: ReachableTile[] = [{ row: unit.row, column: unit.column, distance: 0 }];

  while (frontier.length > 0) {
    const current = frontier.shift()!;
    if (current.distance >= range) continue;
    findNeighbors(current, state.tiles as BattleTile[]).forEach((neighbor) => {
      const key = tileKey(neighbor);
      if (visited.has(key) || occupied.has(key)) return;
      const tile = tilesByKey.get(key);
      if (tile === undefined || !canWalk(unit, tile)) return;
      visited.set(key, current.distance + 1);
      frontier.push({ row: neighbor.row, column: neighbor.column, distance: current.distance + 1 });
    });
  }

  return Array.from(visited.entries())
    .filter(([key]) => key !== tileKey(unit))
    .map(([key, distance]) => {
      const [row, column] = key.split(",").map(Number);
      return { row: row ?? 0, column: column ?? 0, distance };
    });
};

/** Living enemies within the unit's attack range, measured from `from` */
export const attackableEnemies = (
  state: BattleState,
  unit: BattleUnit,
  from: TilePosition = unit,
): ReadonlyArray<BattleUnit> => {
  if (getPieceAttack(unit.piece) <= 0) return [];
  const range = unit.attackRange;
  return livingUnits(state).filter(
    (target) => target.owner !== unit.owner && hexDistance(from, target) <= range,
  );
};

/** Wounded living allies next to the unit that a priest could heal */
export const healableAllies = (
  state: BattleState,
  unit: BattleUnit,
  from: TilePosition = unit,
): ReadonlyArray<BattleUnit> => {
  if (unit.piece.kind !== PieceKind.priest) return [];
  return livingUnits(state).filter(
    (ally) =>
      ally.owner === unit.owner &&
      ally.id !== unit.id &&
      ally.piece.hearts < ally.piece.maxHearts &&
      hexDistance(from, ally) === 1,
  );
};

/** Attack, heal or wait: whether the active unit still has something to do besides moving */
export const hasActionAvailable = (state: BattleState, unit: BattleUnit): boolean =>
  attackableEnemies(state, unit).length > 0 || healableAllies(state, unit).length > 0;

// ============================================
// REDUCER
// ============================================

const replaceUnit = (state: BattleState, updated: BattleUnit): BattleState => ({
  ...state,
  units: state.units.map((unit) => (unit.id === updated.id ? updated : unit)),
});

const withLog = (state: BattleState, entry: string, event: BattleEvent): BattleState => ({
  ...state,
  log: [...state.log, entry],
  events: [...state.events, event],
});

/** A side stands while it has units left and, if it brought a king, he lives */
const winnerOf = (state: BattleState): PlayerType | null => {
  const alive = livingUnits(state);
  const stands = (owner: PlayerType) => {
    const broughtKing = state.units.some((unit) => unit.owner === owner && unit.piece.kind === PieceKind.king);
    const kingAlive = alive.some((unit) => unit.owner === owner && unit.piece.kind === PieceKind.king);
    return alive.some((unit) => unit.owner === owner) && (!broughtKing || kingAlive);
  };
  const dayStands = stands("day");
  const nightStands = stands("night");
  if (dayStands === nightStands) return null;
  return dayStands ? "day" : "night";
};

/** Close the active unit's turn and hand over to the next living unit, starting a new round when needed */
const endTurn = (state: BattleState): BattleState => {
  const current = activeUnit(state);
  const settled = current === null ? state : replaceUnit(state, { ...current, done: true, moved: false });

  const winner = winnerOf(settled);
  if (winner !== null) {
    return withLog({ ...settled, winner }, `${winner === "day" ? "Day" : "Night"} wins the battle!`, {
      type: "victory",
      winner,
    });
  }

  const nextIndex = settled.order.findIndex((id, index) => {
    if (index <= settled.turnIndex) return false;
    const unit = findUnit(settled, id);
    return unit !== null && isUnitAlive(unit);
  });
  if (nextIndex !== -1) return { ...settled, turnIndex: nextIndex };

  const round = settled.round + 1;
  if (settled.maxRounds !== null && round > settled.maxRounds && settled.stalemateWinner !== null) {
    const holder = settled.stalemateWinner;
    return withLog(
      { ...settled, winner: holder },
      `The assault breaks off — ${holder === "day" ? "Day" : "Night"} holds the ground`,
      { type: "victory", winner: holder },
    );
  }
  const rested = settled.units.map((unit) => ({ ...unit, done: false, moved: false }));
  const next = { ...settled, units: rested, order: computeOrder(rested, orderRandom(settled.seed, round)), turnIndex: 0, round };
  return withLog(next, `Round ${round}`, { type: "round", round });
};

export type BattleActionResult =
  | { readonly ok: true; readonly state: BattleState }
  | { readonly ok: false; readonly reason: string };

export const applyBattleAction = (state: BattleState, action: BattleAction): BattleActionResult => {
  if (state.winner !== null) return { ok: false, reason: "The battle is over" };
  const unit = activeUnit(state);
  if (unit === null) return { ok: false, reason: "No unit is active" };
  const name = `${unit.owner} ${describeUnit(unit)}`;

  switch (action.type) {
    case "move": {
      const target = reachableTiles(state, unit).find(
        (tile) => tile.row === action.to.row && tile.column === action.to.column,
      );
      if (target === undefined) return { ok: false, reason: "That tile is out of reach" };
      const moved = replaceUnit(state, { ...unit, row: target.row, column: target.column, moved: true });
      const logged = withLog(moved, `${name} moves`, {
        type: "move",
        unitId: unit.id,
        from: { row: unit.row, column: unit.column },
        to: { row: target.row, column: target.column },
      });
      // Nothing left to do from here: the turn ends by itself
      const after = activeUnit(logged);
      const turnOver = after === null || !hasActionAvailable(logged, after);
      return { ok: true, state: turnOver ? endTurn(logged) : logged };
    }
    case "attack": {
      const target = attackableEnemies(state, unit).find((enemy) => enemy.id === action.targetId);
      if (target === undefined) return { ok: false, reason: "No such enemy in range" };
      const damage = getPieceAttack(unit.piece);
      const struck = pieceWithDamage(target.piece, damage);
      const destroyed = struck.hearts <= 0;
      const absorbed = getPieceDefense(target.piece) - getPieceDefense(struck);
      const detail = destroyed
        ? "and slays it"
        : `for ${damage} (${absorbed} to armour, ${damage - absorbed} to hearts)`;
      const hit = replaceUnit(state, { ...target, piece: struck });
      const logged = withLog(hit, `${name} strikes ${target.owner} ${describeUnit(target)} ${detail}`, {
        type: "attack",
        unitId: unit.id,
        targetId: target.id,
        damage,
        destroyed,
      });
      return { ok: true, state: endTurn(logged) };
    }
    case "heal": {
      const target = healableAllies(state, unit).find((ally) => ally.id === action.targetId);
      if (target === undefined) return { ok: false, reason: "No wounded ally beside the priest" };
      const healed = replaceUnit(state, { ...target, piece: pieceWithHealing(target.piece, 1) });
      const logged = withLog(healed, `${name} heals ${target.owner} ${describeUnit(target)}`, {
        type: "heal",
        unitId: unit.id,
        targetId: target.id,
      });
      return { ok: true, state: endTurn(logged) };
    }
    case "wait": {
      const logged = withLog(state, `${name} waits`, { type: "wait", unitId: unit.id });
      return { ok: true, state: endTurn(logged) };
    }
  }
};

// ============================================
// AI
// ============================================

const targetValue = (target: BattleUnit, damage: number): number => {
  const struck = pieceWithDamage(target.piece, damage);
  const kill = struck.hearts <= 0;
  const heartsLost = target.piece.hearts - struck.hearts;
  const kingBonus = target.piece.kind === PieceKind.king ? 5 : 0;
  const threat = getPieceAttack(target.piece);
  return (kill ? 10 + threat * 2 + kingBonus * 2 : heartsLost * 2 + kingBonus) + threat * 0.5;
};

/**
 * Walking distance from every tile to the nearest of `goals`, through terrain
 * the unit can cross. Other units are ignored so a crowd never reads as a wall.
 */
const distanceField = (
  state: BattleState,
  unit: BattleUnit,
  goals: ReadonlyArray<TilePosition>,
): Map<string, number> => {
  const tilesByKey = new Map(state.tiles.map((tile) => [tileKey(tile), tile]));
  const distances = new Map<string, number>(goals.map((goal) => [tileKey(goal), 0]));
  const frontier: TilePosition[] = [...goals];
  while (frontier.length > 0) {
    const current = frontier.shift()!;
    const here = distances.get(tileKey(current)) ?? 0;
    findNeighbors(current, state.tiles as BattleTile[]).forEach((neighbor) => {
      const key = tileKey(neighbor);
      const tile = tilesByKey.get(key);
      if (distances.has(key) || tile === undefined || !canWalk(unit, tile)) return;
      distances.set(key, here + 1);
      frontier.push(neighbor);
    });
  }
  return distances;
};

const enemyDistanceField = (state: BattleState, unit: BattleUnit): Map<string, number> =>
  distanceField(
    state,
    unit,
    livingUnits(state).filter((other) => other.owner !== unit.owner),
  );

/** Walking distance to the nearest goal; straight-line distance when walled off */
const fieldDistance = (field: Map<string, number>, from: TilePosition, goals: ReadonlyArray<TilePosition>): number =>
  field.get(tileKey(from)) ?? 1000 + Math.min(...goals.map((goal) => hexDistance(from, goal)), 1000);

/**
 * Pick the next action for the active unit: strike the best target it can
 * reach this turn (moving first if that opens a shot), otherwise close in on
 * the nearest enemy. Priests hang back and heal.
 */
export const chooseBattleAction = (state: BattleState): BattleAction => {
  const unit = activeUnit(state);
  if (unit === null) return { type: "wait" };

  const standing: ReachableTile = { row: unit.row, column: unit.column, distance: 0 };
  const hold = state.hold;
  const keepsPost = (tile: TilePosition): boolean =>
    hold === null || hold.owner !== unit.owner || hexDistance(tile, hold.around) <= hold.radius;
  const candidates: ReadonlyArray<ReachableTile> = [standing, ...reachableTiles(state, unit).filter(keepsPost)];
  const damage = getPieceAttack(unit.piece);
  const ranged = unit.attackRange > 1;

  if (unit.piece.kind === PieceKind.priest) {
    const healNow = healableAllies(state, unit);
    if (healNow.length > 0) {
      const weakest = healNow.toSorted((a, b) => a.piece.hearts - b.piece.hearts)[0]!;
      return { type: "heal", targetId: weakest.id };
    }
    if (unit.moved) return { type: "wait" };
    const wounded = livingUnits(state).find(
      (ally) => ally.owner === unit.owner && ally.id !== unit.id && ally.piece.hearts < ally.piece.maxHearts,
    );
    const king = livingUnits(state).find((ally) => ally.owner === unit.owner && ally.piece.kind === PieceKind.king);
    const goal = wounded ?? king;
    if (goal === undefined) return { type: "wait" };
    const toGoal = distanceField(state, unit, [goal]);
    const enemies = livingUnits(state).filter((other) => other.owner !== unit.owner);
    const fromEnemies = enemyDistanceField(state, unit);
    const best = candidates.toSorted(
      (a, b) =>
        fieldDistance(toGoal, a, [goal]) - fieldDistance(toGoal, b, [goal]) ||
        fieldDistance(fromEnemies, b, enemies) - fieldDistance(fromEnemies, a, enemies),
    )[0]!;
    return best === standing ? { type: "wait" } : { type: "move", to: best };
  }

  // Best attack from any reachable tile
  type Plan = { readonly from: ReachableTile; readonly target: BattleUnit; readonly score: number };
  const plans: Plan[] = candidates.flatMap((from) =>
    attackableEnemies(state, unit, from).map((target) => ({
      from,
      target,
      // Archers prefer to shoot from as far away as they can
      score: targetValue(target, damage) + (ranged ? hexDistance(from, target) * 0.3 : 0) - from.distance * 0.05,
    })),
  );
  const best = plans.toSorted((a, b) => b.score - a.score)[0];
  if (best !== undefined) {
    if (best.from !== standing) return { type: "move", to: best.from };
    return { type: "attack", targetId: best.target.id };
  }

  if (unit.moved || damage <= 0) return { type: "wait" };

  // Otherwise advance along the shortest walkable route to the nearest enemy
  const enemies = livingUnits(state).filter((other) => other.owner !== unit.owner);
  const field = enemyDistanceField(state, unit);
  const closest = candidates.toSorted(
    (a, b) => fieldDistance(field, a, enemies) - fieldDistance(field, b, enemies) || a.distance - b.distance,
  )[0]!;
  return closest === standing ? { type: "wait" } : { type: "move", to: closest };
};
