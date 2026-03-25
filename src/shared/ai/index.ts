/**
 * Simple AI that generates all legal actions for a player and picks one
 * using weighted random selection. Used by the CLI auto-player and the
 * self-play test harness.
 */

import type { Game } from "@shared/game/types.ts";
import type { GameAction, PlayerType, TilePosition } from "@shared/actions/index.ts";
import type { Tile } from "@shared/map/tile.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import { BuildingType } from "@shared/building/index.ts";
import { EquipmentType, createEquipment } from "@shared/equipment/index.ts";
import { ResearchType, canResearch, researchCostOf } from "@shared/research/index.ts";
import { SteedType, createSteed } from "@shared/steed/index.ts";
import {
  PieceKind,
  getWalkableLandscape,
  getPieceAttackRange,
  pieceHasEquipment,
} from "@shared/piece/index.ts";
import { canAfford } from "@shared/player/resource-map.ts";
import { buildingCostOf } from "@shared/building/index.ts";
import { findTile, findNeighborTiles, findTilesInRange } from "@shared/tile/index.ts";
import type { RandomFunction } from "@shared/utils/random.ts";

// ============================================
// HELPERS
// ============================================

const getPlayer = (game: Game, playerType: PlayerType) =>
  playerType === "day" ? game.dayPlayer : game.nightPlayer;

// ============================================
// ACTION GENERATORS
// ============================================

const generateMoveActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const myPieces = game.tiles.filter(
    (tile) => tile.piece !== null && tile.piece.owner === player,
  );

  return myPieces.flatMap((fromTile) => {
    const piece = fromTile.piece!;
    const walkable = getWalkableLandscape(piece);
    const neighbors = findNeighborTiles(game.tiles, fromTile);

    return neighbors
      .filter((neighbor) => {
        if (neighbor.piece !== null) return false;
        if (neighbor.landscape === null) return false;
        if (!walkable.includes(neighbor.landscape.type)) return false;
        if (neighbor.building !== null && neighbor.building.owner !== player && !neighbor.building.walkableByEnemy) return false;
        return true;
      })
      .map((neighbor): GameAction => ({
        type: "move",
        player,
        from: { row: fromTile.row, column: fromTile.column },
        to: { row: neighbor.row, column: neighbor.column },
      }));
  });
};

const generateBuildActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const buildableTypes = [BuildingType.house, BuildingType.tower, BuildingType.wall, BuildingType.church]
    .filter((buildingType) => canAfford(playerData.resources, buildingCostOf(buildingType)));

  if (buildableTypes.length === 0) return [];

  const myPiecePositions = game.tiles.filter(
    (tile) => tile.piece !== null && tile.piece.owner === player,
  );

  const seen = new Set<string>();
  const uniqueGrass = myPiecePositions.flatMap((pieceTile) =>
    findNeighborTiles(game.tiles, pieceTile).filter(
      (neighbor) =>
        neighbor.landscape?.type === LandscapeType.grass &&
        neighbor.building === null,
    ),
  ).filter((tile) => {
    const key = `${tile.row},${tile.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueGrass.flatMap((grassTile) =>
    buildableTypes.map((buildingType): GameAction => ({
      type: "build",
      player,
      buildingType,
      position: { row: grassTile.row, column: grassTile.column },
    })),
  );
};

const generateSpawnActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  if (!canAfford(playerData.resources, { wood: 0, stone: 0, iron: 0, gold: 0, food: 1, faith: 0 })) return [];

  return game.tiles
    .filter(
      (tile) =>
        tile.building !== null &&
        tile.building.type === BuildingType.house &&
        tile.building.owner === player &&
        tile.piece === null,
    )
    .map((tile): GameAction => ({
      type: "spawnPeasant",
      player,
      position: { row: tile.row, column: tile.column },
    }));
};

const generateCraftActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const myEquippable = game.tiles.filter(
    (tile) =>
      tile.piece !== null &&
      tile.piece.owner === player &&
      tile.piece.canEquip,
  );

  return myEquippable.flatMap((tile) => {
    const piece = tile.piece!;
    return [EquipmentType.sword, EquipmentType.shield, EquipmentType.bow]
      .filter((equipType) => {
        if (pieceHasEquipment(piece, equipType)) return false;
        const equip = createEquipment(equipType);
        return canAfford(playerData.resources, equip.cost);
      })
      .map((equipmentType): GameAction => ({
        type: "craftEquipment",
        player,
        equipmentType,
        piecePosition: { row: tile.row, column: tile.column },
      }));
  });
};

const generateAttackActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const myPieces = game.tiles.filter(
    (tile) =>
      tile.piece !== null &&
      tile.piece.owner === player &&
      tile.piece.baseAttack > 0,
  );

  return myPieces.flatMap((attackerTile) => {
    const piece = attackerTile.piece!;
    const effectiveRange = (() => {
      if (
        attackerTile.building !== null &&
        attackerTile.building.type === BuildingType.tower &&
        pieceHasEquipment(piece, EquipmentType.bow)
      ) {
        return attackerTile.building.viewRange;
      }
      return getPieceAttackRange(piece);
    })();

    const tilesInRange = findTilesInRange(game.tiles, attackerTile, effectiveRange);

    return tilesInRange
      .map((pos) => findTile(game.tiles, pos))
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => {
        const hasEnemyPiece = tile.piece !== null && tile.piece.owner !== player;
        const hasEnemyBuilding = tile.building !== null && tile.building.owner !== player;
        return hasEnemyPiece || hasEnemyBuilding;
      })
      .map((targetTile): GameAction => ({
        type: "attack",
        player,
        attackerPosition: { row: attackerTile.row, column: attackerTile.column },
        targetPosition: { row: targetTile.row, column: targetTile.column },
      }));
  });
};

const generateTrainActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  if (!canAfford(playerData.resources, { wood: 0, stone: 0, iron: 0, gold: 1, food: 0, faith: 0 })) return [];

  return game.tiles
    .filter(
      (tile) =>
        tile.building !== null &&
        tile.building.type === BuildingType.church &&
        tile.building.owner === player &&
        tile.piece === null,
    )
    .map((tile): GameAction => ({
      type: "trainPriest",
      player,
      churchPosition: { row: tile.row, column: tile.column },
    }));
};

const generateHealActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  if (!canAfford(playerData.resources, { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, faith: 1 })) return [];

  const priests = game.tiles.filter(
    (tile) =>
      tile.piece !== null &&
      tile.piece.kind === PieceKind.priest &&
      tile.piece.owner === player,
  );

  return priests.flatMap((priestTile) =>
    findNeighborTiles(game.tiles, priestTile)
      .filter(
        (neighbor) =>
          neighbor.piece !== null &&
          neighbor.piece.owner === player &&
          neighbor.piece.hearts < neighbor.piece.maxHearts,
      )
      .map((targetTile): GameAction => ({
        type: "heal",
        player,
        priestPosition: { row: priestTile.row, column: priestTile.column },
        targetPosition: { row: targetTile.row, column: targetTile.column },
      })),
  );
};

const generateResearchActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const castles = game.tiles.filter(
    (tile) =>
      tile.building !== null &&
      tile.building.type === BuildingType.castle &&
      tile.building.owner === player,
  );

  if (castles.length === 0) return [];

  const researchable = [ResearchType.speed, ResearchType.miningII, ResearchType.miningIII, ResearchType.queen]
    .filter((researchType) =>
      canResearch(playerData.research, researchType) &&
      canAfford(playerData.resources, researchCostOf(researchType)),
    );

  return castles.flatMap((castle) =>
    researchable.map((researchType): GameAction => ({
      type: "research",
      player,
      researchType,
      castlePosition: { row: castle.row, column: castle.column },
    })),
  );
};

const generateEnterTowerActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const kingTile = game.tiles.find(
    (tile) =>
      tile.piece !== null &&
      tile.piece.kind === PieceKind.king &&
      tile.piece.owner === player,
  );

  if (kingTile === undefined) return [];

  const adjacentTowers = findNeighborTiles(game.tiles, kingTile).filter(
    (tile) =>
      tile.building !== null &&
      tile.building.type === BuildingType.tower &&
      tile.building.owner === player,
  );

  return adjacentTowers.map((towerTile): GameAction => ({
    type: "enterTower",
    player,
    kingPosition: { row: kingTile.row, column: kingTile.column },
    towerPosition: { row: towerTile.row, column: towerTile.column },
  }));
};

const generateSteedActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const houses = game.tiles.filter(
    (tile) =>
      tile.building !== null &&
      tile.building.type === BuildingType.house &&
      tile.building.owner === player,
  );

  if (houses.length === 0) return [];

  const affordableSteeds = [SteedType.horse, SteedType.boat].filter((steedType) =>
    canAfford(playerData.resources, createSteed(steedType).cost),
  );

  if (affordableSteeds.length === 0) return [];

  return houses.flatMap((houseTile) =>
    findNeighborTiles(game.tiles, houseTile)
      .filter((neighbor) => neighbor.piece === null)
      .flatMap((neighbor) =>
        affordableSteeds
          .filter((steedType) => {
            if (steedType === SteedType.boat) {
              return neighbor.landscape?.type === LandscapeType.water;
            }
            return true;
          })
          .map((steedType): GameAction => ({
            type: "buySteed",
            player,
            steedType,
            housePosition: { row: houseTile.row, column: houseTile.column },
            targetPosition: { row: neighbor.row, column: neighbor.column },
          })),
      ),
  );
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Generate all legal actions for a player in the given game state.
 */
export const generateAllActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => [
  ...generateMoveActions(game, player),
  ...generateBuildActions(game, player),
  ...generateSpawnActions(game, player),
  ...generateCraftActions(game, player),
  ...generateAttackActions(game, player),
  ...generateTrainActions(game, player),
  ...generateHealActions(game, player),
  ...generateResearchActions(game, player),
  ...generateEnterTowerActions(game, player),
  ...generateSteedActions(game, player),
];

/**
 * Strategic weights for action types. Higher = more likely to be chosen.
 */
const ACTION_WEIGHTS: Record<string, number> = {
  attack: 50,
  build: 20,
  spawnPeasant: 15,
  craftEquipment: 15,
  move: 10,
  trainPriest: 8,
  heal: 12,
  research: 10,
  enterTower: 5,
  buySteed: 5,
  summonArchAngel: 30,
};

/**
 * Pick an action using weighted random selection.
 * Returns undefined only if there are no actions.
 */
export const pickAction = (
  actions: ReadonlyArray<GameAction>,
  random: RandomFunction,
): GameAction | undefined => {
  if (actions.length === 0) return undefined;

  const weights = actions.map((action) => ACTION_WEIGHTS[action.type] ?? 5);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) return actions.at(Math.floor(random() * actions.length));

  const target = random() * totalWeight;
  const result = weights.reduce<{ sum: number; picked: GameAction | undefined }>(
    (acc, weight, index) => {
      if (acc.picked !== undefined) return acc;
      const newSum = acc.sum + weight;
      return newSum >= target ? { sum: newSum, picked: actions[index] } : { sum: newSum, picked: undefined };
    },
    { sum: 0, picked: undefined },
  );

  return result.picked ?? actions.at(-1);
};
