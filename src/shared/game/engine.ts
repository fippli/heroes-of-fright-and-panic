import type {
  TilePosition,
  ActionResult,
  MoveAction,
  BuildAction,
  SpawnPeasantAction,
  CraftEquipmentAction,
  BuySteedAction,
  TrainPriestAction,
  HealAction,
  ResearchAction,
  EnterTowerAction,
  SummonArchAngelAction,
  AttackAction,
  GameAction,
} from "../actions/index.ts";
import { Building, BuildingType } from "../building/index.ts";
import { resolveCombat } from "../combat/index.ts";
import { Equipment, EquipmentType } from "../equipment/index.ts";
import * as hex from "../map/hex.ts";
import { LandscapeType, Landscape } from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import type { PlayerType } from "../piece/index.ts";
import { Piece, PieceKind } from "../piece/index.ts";
import { Player } from "../player/index.ts";
import { ResourceMap } from "../player/resource-map.ts";
import { calculateProduction, countPrayingPriests } from "../production/index.ts";
import { Research, ResearchType, SPEED_LEVELS } from "../research/index.ts";
import { Steed, SteedType } from "../steed/index.ts";
import type { Game, GameClock } from "./types.ts";

const ARCH_ANGEL_PRIEST_REQUIREMENT = 10;
const PHASE_DURATION_HOURS = 12;

/**
 * Pure game engine. Every method returns a new Game state.
 * No mutation of the input game object.
 */

// ============================================
// CLOCK / TIME MANAGEMENT
// ============================================

const isDay = (time: number): boolean => time >= 6 && time < 18;

const activePlayer = (time: number): PlayerType =>
  isDay(time) ? "day" : "night";

const minutesPerAction = (game: Game, playerType: PlayerType): number => {
  const player = getPlayer(game, playerType);
  const level = SPEED_LEVELS.find(
    (entry) => entry.level === player.research.speedLevel,
  );
  return level !== undefined ? level.minutesPerAction : 60;
};

const advanceClock = (game: Game, playerType: PlayerType): Game => {
  const minutes = minutesPerAction(game, playerType);
  const hoursToAdvance = minutes / 60;
  const newTime = (game.clock.time * 60 + minutes) / 60;
  const wrappedTime = newTime % 24;

  const oldIsDay = isDay(game.clock.time);
  const newIsDay = isDay(wrappedTime);

  // Check for phase transitions
  const crossedDawn = !oldIsDay && newIsDay;
  const crossedDusk = oldIsDay && !newIsDay;

  const newClock: GameClock = {
    time: wrappedTime,
    hasDawned: crossedDawn ? true : game.clock.hasDawned,
    hasDusked: crossedDusk ? true : game.clock.hasDusked,
  };

  const afterClock: Game = {
    ...game,
    clock: newClock,
    currentPlayer: activePlayer(wrappedTime),
  };

  // Trigger production on phase transition
  if (crossedDawn) {
    return triggerProduction(afterClock, "day");
  }
  if (crossedDusk) {
    return triggerProduction(afterClock, "night");
  }

  return afterClock;
};

const triggerProduction = (game: Game, playerType: PlayerType): Game => {
  const player = getPlayer(game, playerType);
  const production = calculateProduction(playerType, game.tiles, player.research);
  const updatedPlayer = player.collect(production);
  return updatePlayer(game, playerType, updatedPlayer);
};

// ============================================
// PLAYER UTILITIES
// ============================================

const getPlayer = (game: Game, playerType: PlayerType): Player =>
  playerType === "day" ? game.dayPlayer : game.nightPlayer;

const updatePlayer = (
  game: Game,
  playerType: PlayerType,
  player: Player,
): Game =>
  playerType === "day"
    ? { ...game, dayPlayer: player }
    : { ...game, nightPlayer: player };

// ============================================
// TILE UTILITIES
// ============================================

const findTile = (
  tiles: ReadonlyArray<Tile>,
  position: TilePosition,
): Tile | undefined =>
  tiles.find(
    (tile) => tile.row === position.row && tile.column === position.column,
  );

const replaceTile = (
  tiles: ReadonlyArray<Tile>,
  newTile: Tile,
): ReadonlyArray<Tile> =>
  tiles.map((tile) =>
    tile.row === newTile.row && tile.column === newTile.column ? newTile : tile,
  );

const getNeighborTiles = (
  tiles: ReadonlyArray<Tile>,
  position: TilePosition,
): Tile[] => hex.findNeighbors(position, tiles as Tile[]);

const getTilesInRange = (
  tiles: ReadonlyArray<Tile>,
  center: TilePosition,
  range: number,
): ReadonlyArray<TilePosition> =>
  Array.from({ length: range }, (_, index) => index).reduce<{
    result: TilePosition[];
    currentLayer: TilePosition[];
  }>(
    (acc, _) => {
      const nextLayer = acc.currentLayer.flatMap((pos) =>
        getNeighborTiles(tiles, pos)
          .filter(
            (neighbor) =>
              !acc.result.some(
                (existing) =>
                  existing.row === neighbor.row &&
                  existing.column === neighbor.column,
              ),
          )
          .map((neighbor) => ({ row: neighbor.row, column: neighbor.column })),
      );
      return {
        result: [...acc.result, ...nextLayer],
        currentLayer: nextLayer,
      };
    },
    { result: [center], currentLayer: [center] },
  ).result;

// ============================================
// TURN VALIDATION
// ============================================

const validateTurn = (game: Game, playerType: PlayerType): ActionResult | null => {
  if (game.gameOver) {
    return { success: false, error: "Game is over" };
  }
  if (game.currentPlayer !== playerType) {
    return { success: false, error: "Not your turn" };
  }
  return null;
};

// ============================================
// ACTION HANDLERS
// ============================================

export const handleMove = (
  game: Game,
  action: MoveAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const fromTile = findTile(game.tiles, action.from);
  const toTile = findTile(game.tiles, action.to);

  if (fromTile === undefined || toTile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (fromTile.piece === null || fromTile.piece.owner !== action.player) {
    return { game, result: { success: false, error: "No piece to move or not your piece" } };
  }

  if (toTile.piece !== null) {
    return { game, result: { success: false, error: "Target tile is occupied" } };
  }

  // Check walkable terrain
  if (
    toTile.landscape === null ||
    !fromTile.piece.walkableLandscape.includes(toTile.landscape.type)
  ) {
    return { game, result: { success: false, error: "Cannot walk on this terrain" } };
  }

  // Check building walkability
  if (toTile.building !== null && !toTile.building.isWalkableBy(action.player)) {
    return { game, result: { success: false, error: "Cannot enter this building" } };
  }

  // Check move range (path must be clear and within range)
  const distance = findDistance(game.tiles, action.from, action.to, fromTile.piece);
  if (distance === null || distance > fromTile.piece.move) {
    return { game, result: { success: false, error: "Target is out of move range" } };
  }

  // Handle mounting a steed
  const movedPiece = (() => {
    if (
      toTile.piece === null &&
      toTile.steed !== undefined &&
      toTile.steed !== null &&
      fromTile.piece.canMountSteed &&
      fromTile.piece.steed === null
    ) {
      return fromTile.piece.withSteed(toTile.steed);
    }
    return fromTile.piece;
  })();

  const updatedTiles = replaceTile(
    replaceTile(game.tiles, { ...fromTile, piece: null }),
    { ...toTile, piece: movedPiece, steed: undefined },
  );

  const afterMove = advanceClock({ ...game, tiles: updatedTiles }, action.player);
  return { game: afterMove, result: { success: true, message: "Piece moved" } };
};

/**
 * Simple BFS distance for movement, respecting walkable terrain.
 * Returns null if no path exists.
 */
const findDistance = (
  tiles: ReadonlyArray<Tile>,
  from: TilePosition,
  to: TilePosition,
  piece: Piece,
): number | null => {
  if (from.row === to.row && from.column === to.column) {
    return 0;
  }

  const visited = new Set<string>();
  visited.add(`${from.row},${from.column}`);
  const frontier: { position: TilePosition; distance: number }[] = [
    { position: from, distance: 0 },
  ];

  // eslint-disable-next-line no-constant-condition
  while (frontier.length > 0) {
    const current = frontier.shift()!;
    if (current.distance >= piece.move) {
      continue;
    }

    const neighbors = getNeighborTiles(tiles, current.position);
    const reachableNeighbor = neighbors.find(
      (neighbor) =>
        neighbor.row === to.row && neighbor.column === to.column,
    );
    if (reachableNeighbor !== undefined) {
      return current.distance + 1;
    }

    neighbors.forEach((neighbor) => {
      const key = `${neighbor.row},${neighbor.column}`;
      if (visited.has(key)) {
        return;
      }
      if (neighbor.piece !== null) {
        return; // Can't pass through occupied tiles
      }
      if (
        neighbor.landscape === null ||
        !piece.walkableLandscape.includes(neighbor.landscape.type)
      ) {
        return;
      }
      visited.add(key);
      frontier.push({
        position: { row: neighbor.row, column: neighbor.column },
        distance: current.distance + 1,
      });
    });
  }

  return null;
};

export const handleBuild = (
  game: Game,
  action: BuildAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const tile = findTile(game.tiles, action.position);
  if (tile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (tile.landscape?.type !== LandscapeType.grass) {
    return { game, result: { success: false, error: "Can only build on grass" } };
  }

  if (tile.building !== null) {
    return { game, result: { success: false, error: "Tile already has a building" } };
  }

  // Must be adjacent to one of your units
  const neighbors = getNeighborTiles(game.tiles, action.position);
  const hasAdjacentUnit = neighbors.some(
    (neighbor) => neighbor.piece !== null && neighbor.piece.owner === action.player,
  );
  if (!hasAdjacentUnit) {
    return {
      game,
      result: { success: false, error: "Must build adjacent to one of your units" },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = Building.costOf(action.buildingType);

  if (!player.canAfford(cost)) {
    return { game, result: { success: false, error: "Cannot afford this building" } };
  }

  const updatedPlayer = player.pay(cost);
  const building = Building[action.buildingType](action.player);

  // When a house is built, adjacent grass tiles convert to farm
  const tilesAfterBuild = (() => {
    const withBuilding = replaceTile(game.tiles, { ...tile, building });
    if (action.buildingType === BuildingType.house) {
      return convertAdjacentGrassToFarm(withBuilding, action.position);
    }
    return withBuilding;
  })();

  const afterBuild = advanceClock(
    updatePlayer({ ...game, tiles: tilesAfterBuild }, action.player, updatedPlayer),
    action.player,
  );
  return { game: afterBuild, result: { success: true, message: `Built ${action.buildingType}` } };
};

const convertAdjacentGrassToFarm = (
  tiles: ReadonlyArray<Tile>,
  housePosition: TilePosition,
): ReadonlyArray<Tile> => {
  const neighbors = getNeighborTiles(tiles, housePosition);
  return neighbors
    .filter(
      (neighbor) =>
        neighbor.landscape?.type === LandscapeType.grass &&
        neighbor.building === null,
    )
    .reduce(
      (acc, neighbor) =>
        replaceTile(acc, { ...neighbor, landscape: Landscape.farm() }),
      tiles,
    );
};

export const handleSpawnPeasant = (
  game: Game,
  action: SpawnPeasantAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const tile = findTile(game.tiles, action.position);
  if (tile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (
    tile.building === null ||
    tile.building.type !== BuildingType.house ||
    tile.building.owner !== action.player
  ) {
    return { game, result: { success: false, error: "Must spawn peasant in your house" } };
  }

  if (tile.piece !== null) {
    return { game, result: { success: false, error: "House already has a unit" } };
  }

  const player = getPlayer(game, action.player);
  const cost = Piece.spawnCost();

  if (!player.canAfford(cost)) {
    return { game, result: { success: false, error: "Cannot afford peasant" } };
  }

  const updatedPlayer = player.pay(cost);
  const peasant = Piece.peasant(action.player);
  const updatedTiles = replaceTile(game.tiles, { ...tile, piece: peasant });

  const afterSpawn = advanceClock(
    updatePlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return { game: afterSpawn, result: { success: true, message: "Spawned peasant" } };
};

export const handleCraftEquipment = (
  game: Game,
  action: CraftEquipmentAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const tile = findTile(game.tiles, action.piecePosition);
  if (tile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (tile.piece === null || tile.piece.owner !== action.player) {
    return { game, result: { success: false, error: "No piece or not your piece" } };
  }

  if (!tile.piece.canEquip) {
    return { game, result: { success: false, error: "This unit cannot carry equipment" } };
  }

  const equipment = Equipment[action.equipmentType]();

  if (tile.piece.hasEquipment(equipment.type)) {
    return { game, result: { success: false, error: "Already has this equipment" } };
  }

  const player = getPlayer(game, action.player);
  if (!player.canAfford(equipment.cost)) {
    return { game, result: { success: false, error: "Cannot afford this equipment" } };
  }

  const updatedPlayer = player.pay(equipment.cost);
  const equippedPiece = tile.piece.withEquipment(equipment);
  const updatedTiles = replaceTile(game.tiles, { ...tile, piece: equippedPiece });

  const afterCraft = advanceClock(
    updatePlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return {
    game: afterCraft,
    result: { success: true, message: `Equipped ${action.equipmentType}` },
  };
};

export const handleBuySteed = (
  game: Game,
  action: BuySteedAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const houseTile = findTile(game.tiles, action.housePosition);
  const targetTile = findTile(game.tiles, action.targetPosition);

  if (houseTile === undefined || targetTile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (
    houseTile.building === null ||
    houseTile.building.type !== BuildingType.house ||
    houseTile.building.owner !== action.player
  ) {
    return { game, result: { success: false, error: "Must buy steed from your house" } };
  }

  if (!hex.isNeighborTo(targetTile, houseTile)) {
    return { game, result: { success: false, error: "Target must be adjacent to house" } };
  }

  // Boats must be placed on water
  if (action.steedType === SteedType.boat) {
    if (targetTile.landscape?.type !== LandscapeType.water) {
      return { game, result: { success: false, error: "Boat must be placed on water" } };
    }
  }

  if (targetTile.piece !== null) {
    return { game, result: { success: false, error: "Target tile is occupied" } };
  }

  const steed = action.steedType === SteedType.horse ? Steed.horse() : Steed.boat();
  const player = getPlayer(game, action.player);

  if (!player.canAfford(steed.cost)) {
    return { game, result: { success: false, error: "Cannot afford steed" } };
  }

  const updatedPlayer = player.pay(steed.cost);
  // Place steed on the target tile (as a steed field, not a piece)
  const updatedTiles = replaceTile(game.tiles, {
    ...targetTile,
    steed,
  } as Tile);

  const afterBuy = advanceClock(
    updatePlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return {
    game: afterBuy,
    result: { success: true, message: `Placed ${action.steedType}` },
  };
};

export const handleTrainPriest = (
  game: Game,
  action: TrainPriestAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const tile = findTile(game.tiles, action.churchPosition);
  if (tile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (
    tile.building === null ||
    tile.building.type !== BuildingType.church ||
    tile.building.owner !== action.player
  ) {
    return { game, result: { success: false, error: "Must train priest at your church" } };
  }

  if (tile.piece !== null) {
    return { game, result: { success: false, error: "Church already has a unit" } };
  }

  const player = getPlayer(game, action.player);
  const cost = Piece.priestCost();

  if (!player.canAfford(cost)) {
    return { game, result: { success: false, error: "Cannot afford priest" } };
  }

  const updatedPlayer = player.pay(cost);
  const priest = Piece.priest(action.player);
  const updatedTiles = replaceTile(game.tiles, { ...tile, piece: priest });

  const afterTrain = advanceClock(
    updatePlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return { game: afterTrain, result: { success: true, message: "Trained priest" } };
};

export const handleHeal = (
  game: Game,
  action: HealAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const priestTile = findTile(game.tiles, action.priestPosition);
  const targetTile = findTile(game.tiles, action.targetPosition);

  if (priestTile === undefined || targetTile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (
    priestTile.piece === null ||
    priestTile.piece.kind !== PieceKind.priest ||
    priestTile.piece.owner !== action.player
  ) {
    return { game, result: { success: false, error: "No priest or not your priest" } };
  }

  if (targetTile.piece === null || targetTile.piece.owner !== action.player) {
    return { game, result: { success: false, error: "No friendly piece to heal" } };
  }

  if (!hex.isNeighborTo(priestTile, targetTile)) {
    return { game, result: { success: false, error: "Target must be adjacent to priest" } };
  }

  if (targetTile.piece.hearts >= targetTile.piece.maxHearts) {
    return { game, result: { success: false, error: "Target is already at full health" } };
  }

  const player = getPlayer(game, action.player);
  const cost = new ResourceMap({ faith: 1 });

  if (!player.canAfford(cost)) {
    return { game, result: { success: false, error: "Not enough faith" } };
  }

  const updatedPlayer = player.pay(cost);
  const healedPiece = targetTile.piece.withHealing(1);
  const updatedTiles = replaceTile(game.tiles, { ...targetTile, piece: healedPiece });

  const afterHeal = advanceClock(
    updatePlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return { game: afterHeal, result: { success: true, message: "Healed 1 heart" } };
};

export const handleResearch = (
  game: Game,
  action: ResearchAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const tile = findTile(game.tiles, action.castlePosition);
  if (tile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (
    tile.building === null ||
    tile.building.type !== BuildingType.castle ||
    tile.building.owner !== action.player
  ) {
    return { game, result: { success: false, error: "Must research at your castle" } };
  }

  const player = getPlayer(game, action.player);

  if (!player.research.canResearch(action.researchType)) {
    return { game, result: { success: false, error: "Cannot research this" } };
  }

  const cost = Research.costOf(action.researchType);

  if (!player.canAfford(cost)) {
    return { game, result: { success: false, error: "Cannot afford research" } };
  }

  const updatedPlayer = player
    .pay(cost)
    .withResearch(player.research.withResearch(action.researchType));

  const afterResearch = advanceClock(
    updatePlayer(game, action.player, updatedPlayer),
    action.player,
  );
  return {
    game: afterResearch,
    result: { success: true, message: `Researched ${action.researchType}` },
  };
};

export const handleEnterTower = (
  game: Game,
  action: EnterTowerAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const kingTile = findTile(game.tiles, action.kingPosition);
  const towerTile = findTile(game.tiles, action.towerPosition);

  if (kingTile === undefined || towerTile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (
    kingTile.piece === null ||
    kingTile.piece.kind !== PieceKind.king ||
    kingTile.piece.owner !== action.player
  ) {
    return { game, result: { success: false, error: "No king or not your king" } };
  }

  if (
    towerTile.building === null ||
    towerTile.building.type !== BuildingType.tower ||
    towerTile.building.owner !== action.player
  ) {
    return { game, result: { success: false, error: "No tower or not your tower" } };
  }

  if (!hex.isNeighborTo(kingTile, towerTile)) {
    return { game, result: { success: false, error: "King must be adjacent to tower" } };
  }

  // Transform tower into castle with king inside
  const castle = Building.castle(action.player);
  const king = kingTile.piece;
  const updatedTiles = replaceTile(
    replaceTile(game.tiles, { ...kingTile, piece: null }),
    { ...towerTile, building: castle, piece: king },
  );

  const afterEnter = advanceClock({ ...game, tiles: updatedTiles }, action.player);
  return { game: afterEnter, result: { success: true, message: "King entered tower, castle created" } };
};

export const handleSummonArchAngel = (
  game: Game,
  action: SummonArchAngelAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const tile = findTile(game.tiles, action.churchPosition);
  if (tile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (
    tile.building === null ||
    tile.building.type !== BuildingType.church ||
    tile.building.owner !== action.player
  ) {
    return { game, result: { success: false, error: "Must summon at your church" } };
  }

  if (tile.piece !== null) {
    return { game, result: { success: false, error: "Church is occupied" } };
  }

  const prayingPriests = countPrayingPriests(action.player, game.tiles);
  if (prayingPriests < ARCH_ANGEL_PRIEST_REQUIREMENT) {
    return {
      game,
      result: {
        success: false,
        error: `Need ${ARCH_ANGEL_PRIEST_REQUIREMENT} praying priests, have ${prayingPriests}`,
      },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = Piece.archAngelCost();

  if (!player.canAfford(cost)) {
    return { game, result: { success: false, error: "Not enough faith" } };
  }

  const updatedPlayer = player.pay(cost);
  const archAngel = Piece.archAngel(action.player);
  const updatedTiles = replaceTile(game.tiles, { ...tile, piece: archAngel });

  const afterSummon = advanceClock(
    updatePlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return { game: afterSummon, result: { success: true, message: "Summoned arch angel" } };
};

export const handleAttack = (
  game: Game,
  action: AttackAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  const attackerTile = findTile(game.tiles, action.attackerPosition);
  const targetTile = findTile(game.tiles, action.targetPosition);

  if (attackerTile === undefined || targetTile === undefined) {
    return { game, result: { success: false, error: "Invalid tile position" } };
  }

  if (attackerTile.piece === null || attackerTile.piece.owner !== action.player) {
    return { game, result: { success: false, error: "No attacker or not your piece" } };
  }

  const attacker = attackerTile.piece;

  // Determine attack range (bow in tower gets tower range)
  const effectiveRange = (() => {
    if (
      attackerTile.building !== null &&
      attackerTile.building.type === BuildingType.tower &&
      attacker.hasEquipment(EquipmentType.bow)
    ) {
      return attackerTile.building.viewRange; // Tower range (4)
    }
    return attacker.attackRange;
  })();

  // Check range
  const tilesInRange = getTilesInRange(game.tiles, action.attackerPosition, effectiveRange);
  const inRange = tilesInRange.some(
    (pos) => pos.row === action.targetPosition.row && pos.column === action.targetPosition.column,
  );

  if (!inRange) {
    return { game, result: { success: false, error: "Target is out of range" } };
  }

  // Determine target: building first (pieces inside buildings are protected),
  // then piece if no enemy building on the tile.
  if (targetTile.building !== null && targetTile.building.owner !== action.player) {
    const combatResult = resolveCombat(attacker, {
      kind: "building",
      building: targetTile.building,
    });

    if (combatResult.targetKind === "building") {
      const updatedTargetTile: Tile = combatResult.destroyed
        ? {
            ...targetTile,
            building: null,
            // If castle destroyed, king inside dies
            piece:
              targetTile.building.type === BuildingType.castle
                ? null
                : targetTile.piece,
          }
        : targetTile;
      const updatedTiles = replaceTile(game.tiles, updatedTargetTile);
      const afterAttack = advanceClock({ ...game, tiles: updatedTiles }, action.player);
      const afterWinCheck = checkWinCondition(afterAttack);
      return { game: afterWinCheck, result: { success: true, message: "Attack successful" } };
    }
  }

  if (targetTile.piece !== null && targetTile.piece.owner !== action.player) {
    const combatResult = resolveCombat(attacker, {
      kind: "piece",
      piece: targetTile.piece,
    });

    if (combatResult.targetKind === "piece") {
      const updatedTargetTile: Tile = combatResult.destroyed
        ? { ...targetTile, piece: null }
        : { ...targetTile, piece: combatResult.survivingPiece };
      const updatedTiles = replaceTile(game.tiles, updatedTargetTile);
      const afterAttack = advanceClock({ ...game, tiles: updatedTiles }, action.player);
      const afterWinCheck = checkWinCondition(afterAttack);
      return { game: afterWinCheck, result: { success: true, message: "Attack successful" } };
    }
  }

  return { game, result: { success: false, error: "No valid target" } };
};

// ============================================
// WIN CONDITION
// ============================================

export const checkWinCondition = (game: Game): Game => {
  if (game.gameOver) {
    return game;
  }

  const dayKingAlive = game.tiles.some(
    (tile) =>
      tile.piece !== null &&
      tile.piece.kind === PieceKind.king &&
      tile.piece.owner === "day",
  );

  const nightKingAlive = game.tiles.some(
    (tile) =>
      tile.piece !== null &&
      tile.piece.kind === PieceKind.king &&
      tile.piece.owner === "night",
  );

  const dayHasPiecesOrHouses =
    dayKingAlive ||
    game.tiles.some(
      (tile) =>
        (tile.piece !== null && tile.piece.owner === "day") ||
        (tile.building !== null &&
          tile.building.type === BuildingType.house &&
          tile.building.owner === "day"),
    );

  const nightHasPiecesOrHouses =
    nightKingAlive ||
    game.tiles.some(
      (tile) =>
        (tile.piece !== null && tile.piece.owner === "night") ||
        (tile.building !== null &&
          tile.building.type === BuildingType.house &&
          tile.building.owner === "night"),
    );

  if (!dayKingAlive || !dayHasPiecesOrHouses) {
    return { ...game, gameOver: true, winner: "night" };
  }

  if (!nightKingAlive || !nightHasPiecesOrHouses) {
    return { ...game, gameOver: true, winner: "day" };
  }

  return game;
};

// ============================================
// VISION (FOG OF WAR)
// ============================================

export const getVisibleTiles = (
  game: Game,
  playerType: PlayerType,
): Set<string> => {
  const player = getPlayer(game, playerType);
  const visible = new Set<string>();

  game.tiles.forEach((tile) => {
    // Pieces reveal tiles within their view range
    if (tile.piece !== null && tile.piece.owner === playerType) {
      const tilesInRange = getTilesInRange(game.tiles, tile, tile.piece.view);
      tilesInRange.forEach((pos) => visible.add(`${pos.row},${pos.column}`));
    }

    // Buildings reveal tiles within their view range
    if (tile.building !== null && tile.building.owner === playerType) {
      const tilesInRange = getTilesInRange(game.tiles, tile, tile.building.viewRange);
      tilesInRange.forEach((pos) => visible.add(`${pos.row},${pos.column}`));

      // Queen research: all tiles adjacent to buildings become visible
      if (player.research.hasQueen) {
        const neighbors = getNeighborTiles(game.tiles, tile);
        neighbors.forEach((neighbor) =>
          visible.add(`${neighbor.row},${neighbor.column}`),
        );
      }
    }
  });

  return visible;
};

export const getFilteredGameState = (game: Game, forPlayer: PlayerType): Game => {
  const visible = getVisibleTiles(game, forPlayer);

  const filteredTiles = game.tiles.map((tile) => {
    if (visible.has(`${tile.row},${tile.column}`)) {
      return tile;
    }
    return {
      ...tile,
      piece: null,
      building: null,
      landscape: new Landscape({ type: LandscapeType.unexplored }),
    } as Tile;
  });

  return {
    ...game,
    tiles: filteredTiles,
    dayPlayer:
      forPlayer === "day"
        ? game.dayPlayer
        : new Player({ type: "day" }),
    nightPlayer:
      forPlayer === "night"
        ? game.nightPlayer
        : new Player({ type: "night" }),
  };
};

// ============================================
// ACTION DISPATCHER
// ============================================

export const handleAction = (
  game: Game,
  action: GameAction,
): { readonly game: Game; readonly result: ActionResult } => {
  switch (action.type) {
    case "move":
      return handleMove(game, action);
    case "build":
      return handleBuild(game, action);
    case "spawnPeasant":
      return handleSpawnPeasant(game, action);
    case "craftEquipment":
      return handleCraftEquipment(game, action);
    case "buySteed":
      return handleBuySteed(game, action);
    case "trainPriest":
      return handleTrainPriest(game, action);
    case "heal":
      return handleHeal(game, action);
    case "research":
      return handleResearch(game, action);
    case "enterTower":
      return handleEnterTower(game, action);
    case "summonArchAngel":
      return handleSummonArchAngel(game, action);
    case "attack":
      return handleAttack(game, action);
    default:
      return { game, result: { success: false, error: "Unknown action type" } };
  }
};
