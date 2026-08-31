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
  SummonArchAngelAction,
  AttackAction,
  PassAction,
  UpgradeBuildingAction,
  GameAction,
} from "../actions/index.ts";
import {
  createBuilding,
  BuildingType,
  buildingLevel,
  houseUpgradeCost,
  castleUpgradeCost,
  towerUpgradeCost,
  HOUSE_LEVEL_NAMES,
  CASTLE_LEVEL_NAMES,
  TOWER_LEVEL_NAMES,
} from "../building/index.ts";
import { resolveCombat } from "../combat/index.ts";
import { createEquipment, EquipmentType } from "../equipment/index.ts";
import {
  LandscapeType,
  farm as farmLandscape,
  unexplored as unexploredLandscape,
} from "../map/landscape.ts";
import type { Tile } from "../map/tile.ts";
import { populationOf } from "./population.ts";
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
import { canResearch, applyResearch } from "../research/index.ts";
import { createSteed, SteedType } from "../steed/index.ts";
import {
  findTile,
  replaceTile,
  findNeighborTiles,
  areNeighbors,
  findTilesInRange,
} from "../tile/index.ts";
import type { Game } from "./types.ts";
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

/**
 * A phase is a round: every piece and building may act once. Ending the
 * phase flips the clock to the next dawn/dusk, hands the turn over, runs
 * production for the side whose night/day begins, and rests every actor.
 */
export const endPhase = (game: Game, playerType: PlayerType): Game => {
  const toNight = playerType === "day";
  const rested = game.tiles.map((tile): Tile => {
    let next = tile;
    if (next.piece !== null && next.piece.acted === true) {
      next = { ...next, piece: { ...next.piece, acted: false } };
    }
    if (next.building !== null && next.building.acted === true) {
      next = { ...next, building: { ...next.building, acted: false } };
    }
    return next;
  });
  const flipped: Game = {
    ...game,
    tiles: rested,
    clock: {
      time: toNight ? 18 : 6,
      hasDawned: toNight ? game.clock.hasDawned : true,
      hasDusked: toNight ? true : game.clock.hasDusked,
    },
    currentPlayer: toNight ? "night" : "day",
  };
  return triggerProduction(flipped, flipped.currentPlayer);
};

/** Mark the piece on a tile as having used its action this phase */
const restPiece = (tiles: ReadonlyArray<Tile>, position: TilePosition): ReadonlyArray<Tile> => {
  const tile = findTile(tiles, position);
  if (tile === undefined || tile.piece === null) return tiles;
  return replaceTile(tiles, { ...tile, piece: { ...tile.piece, acted: true } });
};

/** Mark the building on a tile as having used its action this phase */
const restBuilding = (tiles: ReadonlyArray<Tile>, position: TilePosition): ReadonlyArray<Tile> => {
  const tile = findTile(tiles, position);
  if (tile === undefined || tile.building === null) return tiles;
  return replaceTile(tiles, { ...tile, building: { ...tile.building, acted: true } });
};

const pieceAlreadyActed = { success: false, error: "This piece has already acted this phase" } as const;
const buildingAlreadyActed = { success: false, error: "This building has already acted this phase" } as const;

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

  const mover = findTile(game.tiles, action.from);
  if (mover?.piece?.acted === true) {
    return { game, result: pieceAlreadyActed };
  }

  const updatedTiles = restPiece(executeMove(game.tiles, action.from, action.to), action.to);
  return { game: { ...game, tiles: updatedTiles }, result: { success: true, message: "Piece moved" } };
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

  if (action.buildingType === BuildingType.dock) {
    // Docks stand on the shore: sand with water next to it
    if (tile.landscape?.type !== LandscapeType.sand) {
      return { game, result: { success: false, error: "A dock must be built on sand" } };
    }
    const touchesWater = findNeighborTiles(game.tiles, action.position).some(
      (neighbor) => neighbor.landscape?.type === LandscapeType.water,
    );
    if (!touchesWater) {
      return { game, result: { success: false, error: "A dock must be next to water" } };
    }
  } else if (tile.landscape?.type !== LandscapeType.grass) {
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

  const afterBuild = withPlayer(
    { ...game, tiles: restBuilding(tilesAfterBuild, action.position) },
    action.player,
    updatedPlayer,
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

  const population = populationOf(game.tiles, action.player);
  if (population.peasants >= population.capacity) {
    return {
      game,
      result: {
        success: false,
        error: `No room: ${population.peasants}/${population.capacity} peasants housed. Build or upgrade houses.`,
      },
    };
  }

  const player = getPlayer(game, action.player);
  const cost = costOfSpawnPeasant();

  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Cannot afford peasant" } };
  }

  if (tile.building.acted === true) {
    return { game, result: buildingAlreadyActed };
  }

  const updatedPlayer = payForCost(player, cost);
  const peasant = { ...createPeasant(action.player), acted: true };
  const updatedTiles = replaceTile(game.tiles, {
    ...tile,
    piece: peasant,
    building: { ...tile.building, acted: true },
  });

  return {
    game: withPlayer({ ...game, tiles: updatedTiles }, action.player, updatedPlayer),
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

  if (tile.piece.acted === true) {
    return { game, result: pieceAlreadyActed };
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

  const afterCraft = withPlayer(
    { ...game, tiles: restPiece(updatedTiles, action.piecePosition) },
    action.player,
    updatedPlayer,
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

  // Horses come from houses, boats are built at docks
  const sourceType = action.steedType === SteedType.boat ? BuildingType.dock : BuildingType.house;
  if (
    houseTile.building === null ||
    houseTile.building.type !== sourceType ||
    houseTile.building.owner !== action.player
  ) {
    return {
      game,
      result: {
        success: false,
        error: action.steedType === SteedType.boat ? "Boats are built at your dock" : "Horses are bought at your house",
      },
    };
  }

  if (!areNeighbors(targetTile, houseTile)) {
    return {
      game,
      result: { success: false, error: `Target must be next to the ${sourceType}` },
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

  const afterBuy = withPlayer(
    { ...game, tiles: restBuilding(updatedTiles, action.housePosition) },
    action.player,
    updatedPlayer,
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

  const afterTrain = withPlayer(
    { ...game, tiles: restBuilding(updatedTiles, action.churchPosition) },
    action.player,
    updatedPlayer,
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

  if (priestTile.piece.acted === true) {
    return { game, result: pieceAlreadyActed };
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

  const afterHeal = withPlayer(
    { ...game, tiles: restPiece(updatedTiles, action.priestPosition) },
    action.player,
    updatedPlayer,
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

  if (buildingLevel(tile.building) < 2) {
    return {
      game,
      result: { success: false, error: "Research needs a Castle — upgrade your Keep first" },
    };
  }

  if (tile.building.acted === true) {
    return { game, result: buildingAlreadyActed };
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

  const afterResearch = withPlayer(
    { ...game, tiles: restBuilding(game.tiles, action.castlePosition) },
    action.player,
    updatedPlayer,
  );
  return {
    game: afterResearch,
    result: { success: true, message: `Researched ${action.researchType}` },
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

  const afterSummon = withPlayer(
    { ...game, tiles: restBuilding(updatedTiles, action.churchPosition) },
    action.player,
    updatedPlayer,
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
      const updatedTiles = restPiece(replaceTile(game.tiles, updatedTargetTile), action.attackerPosition);
      const afterWinCheck = checkWinCondition({ ...game, tiles: updatedTiles });
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
      const updatedTiles = restPiece(replaceTile(game.tiles, updatedTargetTile), action.attackerPosition);
      const afterWinCheck = checkWinCondition({ ...game, tiles: updatedTiles });
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
  const UPGRADABLE = [BuildingType.house, BuildingType.castle, BuildingType.tower];
  if (
    tile.building === null ||
    !UPGRADABLE.includes(tile.building.type) ||
    tile.building.owner !== action.player
  ) {
    return { game, result: { success: false, error: "Only your own houses, towers and castle can be upgraded" } };
  }

  if (tile.building.acted === true) {
    return { game, result: buildingAlreadyActed };
  }

  const isCastle = tile.building.type === BuildingType.castle;
  const isTower = tile.building.type === BuildingType.tower;
  const level = buildingLevel(tile.building);
  const cost = isCastle ? castleUpgradeCost(level) : isTower ? towerUpgradeCost(level) : houseUpgradeCost(level);
  if (cost === null) {
    return {
      game,
      result: {
        success: false,
        error: isCastle ? "Your castle is already a citadel" : isTower ? "This tower is already a beacon" : "This house is already a manor",
      },
    };
  }

  const player = getPlayer(game, action.player);
  if (!canAffordCost(player, cost)) {
    return { game, result: { success: false, error: "Cannot afford this upgrade" } };
  }

  const names = isCastle ? CASTLE_LEVEL_NAMES : isTower ? TOWER_LEVEL_NAMES : HOUSE_LEVEL_NAMES;
  const upgraded = replaceTile(game.tiles, {
    ...tile,
    building: isCastle
      ? { ...tile.building, level: level + 1, viewRange: 2 + level, defense: 2 + level, acted: true }
      : isTower
        ? { ...tile.building, level: level + 1, viewRange: 2 + level, defense: level + 1, acted: true }
        : { ...tile.building, level: level + 1, acted: true },
  });
  const afterUpgrade = withPlayer({ ...game, tiles: upgraded }, action.player, payForCost(player, cost));
  return {
    game: afterUpgrade,
    result: { success: true, message: `Upgraded to ${names[level + 1]}` },
  };
};

// ============================================
// PASS
// ============================================

/** End the phase: night falls (or day breaks), everything rests */
export const handlePass = (
  game: Game,
  action: PassAction,
): { readonly game: Game; readonly result: ActionResult } => {
  const turnError = validateTurn(game, action.player);
  if (turnError !== null) {
    return { game, result: turnError };
  }

  return {
    game: endPhase(game, action.player),
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

  const dayCastleStands = game.tiles.some(
    (tile) => tile.building !== null && tile.building.type === BuildingType.castle && tile.building.owner === "day",
  );
  const nightCastleStands = game.tiles.some(
    (tile) => tile.building !== null && tile.building.type === BuildingType.castle && tile.building.owner === "night",
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

  if (!dayKingAlive || !dayCastleStands || !dayHasPiecesOrHouses) {
    return { ...game, gameOver: true, winner: "night" };
  }

  if (!nightKingAlive || !nightCastleStands || !nightHasPiecesOrHouses) {
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
