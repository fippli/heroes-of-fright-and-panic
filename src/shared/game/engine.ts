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
  PassAction,
  UpgradeBuildingAction,
  GameAction,
} from "../actions/index.ts";
import {
  createBuilding,
  createCastleBuilding,
  BuildingType,
  buildingLevel,
  houseUpgradeCost,
  HOUSE_LEVEL_NAMES,
} from "../building/index.ts";
import { resolveCombat } from "../combat/index.ts";
import { createEquipment, EquipmentType } from "../equipment/index.ts";
import {
  LandscapeType,
  farm as farmLandscape,
  unexplored as unexploredLandscape,
} from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import type { PlayerType } from "../piece/index.ts";
import {
  PieceKind,
  createPeasant,
  createPriest,
  createArchAngel,
  getPieceView,
  getPieceAttackRange,
  amplifiedView,
  pieceHasEquipment,
  pieceWithEquipment,
  pieceWithHealing,
} from "../piece/index.ts";
import { createPlayer, playerWithResearch } from "../player/index.ts";
import { canResearch, applyResearch, SPEED_LEVELS } from "../research/index.ts";
import { createSteed, SteedType } from "../steed/index.ts";
import {
  findTile,
  replaceTile,
  findNeighborTiles,
  areNeighbors,
  findTilesInRange,
} from "../tile/index.ts";
import type { Game, GameClock } from "./types.ts";
import { getPlayer, withPlayer } from "./state.ts";
import { validateMove, executeMove } from "../movement/index.ts";
import {
  canAffordCost,
  payForCost,
  costOfBuilding,
  costOfEquipment,
  costOfSteed,
  costOfSpawnPeasant,
  costOfTrainPriest,
  costOfSummonArchAngel,
  costOfResearch,
  costOfHeal,
  countPrayingPriests,
  triggerProduction,
} from "../resource/index.ts";

const ARCH_ANGEL_PRIEST_REQUIREMENT = 10;

/**
 * Pure game engine. Every function returns a new Game state.
 * No mutation of the input game object.
 *
 * Delegates to:
 * - movement engine for move validation and execution
 * - resource engine for cost checks, payments, and production
 * - combat module for attack resolution
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
  const newTime = (game.clock.time * 60 + minutes) / 60;
  const wrappedTime = newTime % 24;

  const oldIsDay = isDay(game.clock.time);
  const newIsDay = isDay(wrappedTime);

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

  if (crossedDawn) {
    return triggerProduction(afterClock, "day");
  }
  if (crossedDusk) {
    return triggerProduction(afterClock, "night");
  }

  return afterClock;
};

// ============================================
// TURN VALIDATION
// ============================================

const validateTurn = (
  game: Game,
  playerType: PlayerType,
): ActionResult | null => {
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

  const validation = validateMove(
    game.tiles,
    action.from,
    action.to,
    action.player,
  );
  if (!validation.valid) {
    return { game, result: { success: false, error: validation.error } };
  }

  const updatedTiles = executeMove(game.tiles, action.from, action.to);
  const afterMove = advanceClock(
    { ...game, tiles: updatedTiles },
    action.player,
  );
  return { game: afterMove, result: { success: true, message: "Piece moved" } };
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
    return {
      game,
      result: { success: false, error: "Can only build on grass" },
    };
  }

  if (tile.building !== null) {
    return {
      game,
      result: { success: false, error: "Tile already has a building" },
    };
  }

  // Your kingdom is what you can see: buildings may only go on tiles
  // currently within your field of vision.
  const kingdom = getVisibleTiles(game, action.player);
  if (!kingdom.has(`${action.position.row},${action.position.column}`)) {
    return {
      game,
      result: {
        success: false,
        error: "Can only build within your kingdom (tiles you can see)",
      },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = costOfBuilding(action.buildingType);

  if (!canAffordCost(player, cost)) {
    return {
      game,
      result: { success: false, error: "Cannot afford this building" },
    };
  }

  const updatedPlayer = payForCost(player, cost);
  const building = createBuilding(action.buildingType, action.player);

  const tilesAfterBuild = (() => {
    const withBuilding = replaceTile(game.tiles, { ...tile, building });
    if (action.buildingType === BuildingType.house) {
      return convertAdjacentGrassToFarm(withBuilding, action.position);
    }
    return withBuilding;
  })();

  const afterBuild = advanceClock(
    withPlayer(
      { ...game, tiles: tilesAfterBuild },
      action.player,
      updatedPlayer,
    ),
    action.player,
  );
  return {
    game: afterBuild,
    result: { success: true, message: `Built ${action.buildingType}` },
  };
};

const convertAdjacentGrassToFarm = (
  tiles: ReadonlyArray<Tile>,
  housePosition: TilePosition,
): ReadonlyArray<Tile> => {
  const neighbors = findNeighborTiles(tiles, housePosition);
  return neighbors
    .filter(
      (neighbor) =>
        neighbor.landscape?.type === LandscapeType.grass &&
        neighbor.building === null,
    )
    .reduce(
      (acc, neighbor) =>
        replaceTile(acc, { ...neighbor, landscape: farmLandscape() }),
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
    return {
      game,
      result: { success: false, error: "Must spawn peasant in your house" },
    };
  }

  if (tile.piece !== null) {
    return {
      game,
      result: { success: false, error: "House already has a unit" },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = costOfSpawnPeasant();

  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Cannot afford peasant" } };
  }

  const updatedPlayer = payForCost(player, cost);
  const peasant = createPeasant(action.player);
  const updatedTiles = replaceTile(game.tiles, { ...tile, piece: peasant });

  const afterSpawn = advanceClock(
    withPlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return {
    game: afterSpawn,
    result: { success: true, message: "Spawned peasant" },
  };
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
    return {
      game,
      result: { success: false, error: "No piece or not your piece" },
    };
  }

  if (!tile.piece.canEquip) {
    return {
      game,
      result: { success: false, error: "This unit cannot carry equipment" },
    };
  }

  const equipment = createEquipment(action.equipmentType);

  if (pieceHasEquipment(tile.piece, equipment.type)) {
    return {
      game,
      result: { success: false, error: "Already has this equipment" },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = costOfEquipment(action.equipmentType);

  if (!canAffordCost(player, cost)) {
    return {
      game,
      result: { success: false, error: "Cannot afford this equipment" },
    };
  }

  const updatedPlayer = payForCost(player, cost);
  const equippedPiece = pieceWithEquipment(tile.piece, equipment);
  const updatedTiles = replaceTile(game.tiles, {
    ...tile,
    piece: equippedPiece,
  });

  const afterCraft = advanceClock(
    withPlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
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
    return {
      game,
      result: { success: false, error: "Must buy steed from your house" },
    };
  }

  if (!areNeighbors(targetTile, houseTile)) {
    return {
      game,
      result: { success: false, error: "Target must be adjacent to house" },
    };
  }

  if (action.steedType === SteedType.boat) {
    if (targetTile.landscape?.type !== LandscapeType.water) {
      return {
        game,
        result: { success: false, error: "Boat must be placed on water" },
      };
    }
  }

  if (targetTile.piece !== null) {
    return {
      game,
      result: { success: false, error: "Target tile is occupied" },
    };
  }

  const steed = createSteed(action.steedType);
  const player = getPlayer(game, action.player);
  const cost = costOfSteed(action.steedType);

  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Cannot afford steed" } };
  }

  const updatedPlayer = payForCost(player, cost);
  const updatedTiles = replaceTile(game.tiles, {
    ...targetTile,
    steed,
  } as Tile);

  const afterBuy = advanceClock(
    withPlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
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
    return {
      game,
      result: { success: false, error: "Must train priest at your church" },
    };
  }

  if (tile.piece !== null) {
    return {
      game,
      result: { success: false, error: "Church already has a unit" },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = costOfTrainPriest();

  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Cannot afford priest" } };
  }

  const updatedPlayer = payForCost(player, cost);
  const priest = createPriest(action.player);
  const updatedTiles = replaceTile(game.tiles, { ...tile, piece: priest });

  const afterTrain = advanceClock(
    withPlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return {
    game: afterTrain,
    result: { success: true, message: "Trained priest" },
  };
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
    return {
      game,
      result: { success: false, error: "No priest or not your priest" },
    };
  }

  if (targetTile.piece === null || targetTile.piece.owner !== action.player) {
    return {
      game,
      result: { success: false, error: "No friendly piece to heal" },
    };
  }

  if (!areNeighbors(priestTile, targetTile)) {
    return {
      game,
      result: { success: false, error: "Target must be adjacent to priest" },
    };
  }

  if (targetTile.piece.hearts >= targetTile.piece.maxHearts) {
    return {
      game,
      result: { success: false, error: "Target is already at full health" },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = costOfHeal();

  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Not enough faith" } };
  }

  const updatedPlayer = payForCost(player, cost);
  const healedPiece = pieceWithHealing(targetTile.piece, 1);
  const updatedTiles = replaceTile(game.tiles, {
    ...targetTile,
    piece: healedPiece,
  });

  const afterHeal = advanceClock(
    withPlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return {
    game: afterHeal,
    result: { success: true, message: "Healed 1 heart" },
  };
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
    return {
      game,
      result: { success: false, error: "Must research at your castle" },
    };
  }

  const player = getPlayer(game, action.player);

  if (!canResearch(player.research, action.researchType)) {
    return { game, result: { success: false, error: "Cannot research this" } };
  }

  const cost = costOfResearch(action.researchType);

  if (!canAffordCost(player, cost)) {
    return {
      game,
      result: { success: false, error: "Cannot afford research" },
    };
  }

  const updatedPlayer = playerWithResearch(
    payForCost(player, cost),
    applyResearch(player.research, action.researchType),
  );

  const afterResearch = advanceClock(
    withPlayer(game, action.player, updatedPlayer),
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
    return {
      game,
      result: { success: false, error: "No king or not your king" },
    };
  }

  if (
    towerTile.building === null ||
    towerTile.building.type !== BuildingType.tower ||
    towerTile.building.owner !== action.player
  ) {
    return {
      game,
      result: { success: false, error: "No tower or not your tower" },
    };
  }

  if (!areNeighbors(kingTile, towerTile)) {
    return {
      game,
      result: { success: false, error: "King must be adjacent to tower" },
    };
  }

  const castle = createCastleBuilding(action.player);
  const king = kingTile.piece;
  const updatedTiles = replaceTile(
    replaceTile(game.tiles, { ...kingTile, piece: null }),
    { ...towerTile, building: castle, piece: king },
  );

  const afterEnter = advanceClock(
    { ...game, tiles: updatedTiles },
    action.player,
  );
  return {
    game: afterEnter,
    result: { success: true, message: "King entered tower, castle created" },
  };
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
    return {
      game,
      result: { success: false, error: "Must summon at your church" },
    };
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
  const cost = costOfSummonArchAngel();

  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Not enough faith" } };
  }

  const updatedPlayer = payForCost(player, cost);
  const archAngel = createArchAngel(action.player);
  const updatedTiles = replaceTile(game.tiles, { ...tile, piece: archAngel });

  const afterSummon = advanceClock(
    withPlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
    action.player,
  );
  return {
    game: afterSummon,
    result: { success: true, message: "Summoned arch angel" },
  };
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

  if (
    attackerTile.piece === null ||
    attackerTile.piece.owner !== action.player
  ) {
    return {
      game,
      result: { success: false, error: "No attacker or not your piece" },
    };
  }

  const attacker = attackerTile.piece;

  const effectiveRange = (() => {
    if (
      attackerTile.building !== null &&
      attackerTile.building.type === BuildingType.tower &&
      pieceHasEquipment(attacker, EquipmentType.bow)
    ) {
      return attackerTile.building.viewRange;
    }
    return getPieceAttackRange(attacker);
  })();

  const tilesInRange = findTilesInRange(
    game.tiles,
    action.attackerPosition,
    effectiveRange,
  );
  const inRange = tilesInRange.some(
    (pos) =>
      pos.row === action.targetPosition.row &&
      pos.column === action.targetPosition.column,
  );

  if (!inRange) {
    return {
      game,
      result: { success: false, error: "Target is out of range" },
    };
  }

  if (
    targetTile.building !== null &&
    targetTile.building.owner !== action.player
  ) {
    const combatResult = resolveCombat(attacker, {
      kind: "building",
      building: targetTile.building,
    });

    if (combatResult.targetKind === "building") {
      const updatedTargetTile: Tile = combatResult.destroyed
        ? {
            ...targetTile,
            building: null,
            piece:
              targetTile.building.type === BuildingType.castle
                ? null
                : targetTile.piece,
          }
        : targetTile;
      const updatedTiles = replaceTile(game.tiles, updatedTargetTile);
      const afterAttack = advanceClock(
        { ...game, tiles: updatedTiles },
        action.player,
      );
      const afterWinCheck = checkWinCondition(afterAttack);
      return {
        game: afterWinCheck,
        result: { success: true, message: "Attack successful" },
      };
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
      const afterAttack = advanceClock(
        { ...game, tiles: updatedTiles },
        action.player,
      );
      const afterWinCheck = checkWinCondition(afterAttack);
      return {
        game: afterWinCheck,
        result: { success: true, message: "Attack successful" },
      };
    }
  }

  return { game, result: { success: false, error: "No valid target" } };
};

/**
 * What a spectator may see: the union of both players' fields of vision.
 * Anything neither side can currently see stays fog.
 */
export const getSpectatorGameState = (game: Game): Game => {
  const day = getVisibleTiles(game, "day");
  const night = getVisibleTiles(game, "night");
  const filteredTiles = game.tiles.map((tile) => {
    const key = `${tile.row},${tile.column}`;
    if (day.has(key) || night.has(key)) return tile;
    return { ...tile, piece: null, building: null, landscape: unexploredLandscape() } as Tile;
  });
  return { ...game, tiles: filteredTiles };
};

// ============================================
// UPGRADE
// ============================================

/** Raise a house one level; higher levels work the surrounding land harder */
export const handleUpgradeBuilding = (
  game: Game,
  action: UpgradeBuildingAction,
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
    return { game, result: { success: false, error: "Only your own houses can be upgraded" } };
  }

  const level = buildingLevel(tile.building);
  const cost = houseUpgradeCost(level);
  if (cost === null) {
    return { game, result: { success: false, error: "This house is already a manor" } };
  }

  const player = getPlayer(game, action.player);
  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Cannot afford this upgrade" } };
  }

  const upgraded = replaceTile(game.tiles, { ...tile, building: { ...tile.building, level: level + 1 } });
  const afterUpgrade = advanceClock(
    withPlayer({ ...game, tiles: upgraded }, action.player, payForCost(player, cost)),
    action.player,
  );
  return {
    game: afterUpgrade,
    result: { success: true, message: `Upgraded to ${HOUSE_LEVEL_NAMES[level + 1]}` },
  };
};

// ============================================
// PASS
// ============================================

/** Advance the clock without acting: one tick, or until the phase changes */
export const handlePass = (
  game: Game,
  action: PassAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  if (action.toPhaseEnd !== true) {
    return {
      game: advanceClock(game, action.player),
      result: { success: true, message: "Waited an hour" },
    };
  }

  // Tick until the other side's phase begins (bounded: a phase is at most
  // 12 hours at 60 minutes per action, more with Speed research)
  let current = game;
  let ticks = 0;
  while (current.currentPlayer === action.player && ticks < 1000) {
    current = advanceClock(current, action.player);
    ticks += 1;
  }
  return {
    game: current,
    result: { success: true, message: `Ended the ${action.player} phase` },
  };
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
    // Pieces are the only source of field of vision. A friendly building the
    // piece occupies amplifies its view (e.g. a peasant in a tower sees 4).
    if (tile.piece !== null && tile.piece.owner === playerType) {
      const occupiedBuilding =
        tile.building !== null && tile.building.owner === playerType
          ? tile.building.viewRange
          : undefined;
      const view = amplifiedView(getPieceView(tile.piece), occupiedBuilding);
      const tilesInRange = findTilesInRange(game.tiles, tile, view);
      tilesInRange.forEach((pos) => visible.add(`${pos.row},${pos.column}`));
    }

    // Buildings produce no field of vision of their own, but you always see
    // your own building's tile, and Queen research reveals its neighbors.
    if (tile.building !== null && tile.building.owner === playerType) {
      visible.add(`${tile.row},${tile.column}`);

      if (player.research.hasQueen) {
        const neighbors = findNeighborTiles(game.tiles, tile);
        neighbors.forEach((neighbor) =>
          visible.add(`${neighbor.row},${neighbor.column}`),
        );
      }
    }
  });

  return visible;
};

export const getFilteredGameState = (
  game: Game,
  forPlayer: PlayerType,
): Game => {
  const visible = getVisibleTiles(game, forPlayer);

  const filteredTiles = game.tiles.map((tile) => {
    if (visible.has(`${tile.row},${tile.column}`)) {
      return tile;
    }
    return {
      ...tile,
      piece: null,
      building: null,
      landscape: unexploredLandscape(),
    } as Tile;
  });

  return {
    ...game,
    tiles: filteredTiles,
    dayPlayer:
      forPlayer === "day" ? game.dayPlayer : createPlayer({ type: "day" }),
    nightPlayer:
      forPlayer === "night"
        ? game.nightPlayer
        : createPlayer({ type: "night" }),
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
    case "pass":
      return handlePass(game, action);
    case "upgradeBuilding":
      return handleUpgradeBuilding(game, action);
    default:
      return { game, result: { success: false, error: "Unknown action type" } };
  }
};
