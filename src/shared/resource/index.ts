/**
 * Resource engine — handles all resource-related logic:
 * - Production calculation (what tiles produce at dawn/dusk)
 * - Cost validation and payment
 * - Resource collection
 * - All cost lookups centralized
 */

import { BuildingType, buildingCostOf } from "@shared/building/index.ts";
import { createEquipment, type EquipmentType } from "@shared/equipment/index.ts";
import * as hex from "@shared/map/hex.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import type { Tile } from "@shared/map/tile.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import {
  PieceKind,
  peasantSpawnCost,
  priestTrainCost,
  archAngelSummonCost,
} from "@shared/piece/index.ts";
import type { Player } from "@shared/player/index.ts";
import {
  playerCanAfford,
  playerPay,
  playerCollect,
} from "@shared/player/index.ts";
import {
  createResourceMap,
  addResources,
  type ResourceMap,
} from "@shared/player/resource-map.ts";
import { researchCostOf, type ResearchType } from "@shared/research/index.ts";
import type { Research } from "@shared/research/index.ts";
import { createSteed, type SteedType } from "@shared/steed/index.ts";
import type { Game } from "@shared/game/types.ts";

// ============================================
// COST LOOKUPS
// ============================================

export const costOfBuilding = (buildingType: BuildingType): ResourceMap =>
  buildingCostOf(buildingType);

export const costOfEquipment = (equipmentType: EquipmentType): ResourceMap =>
  createEquipment(equipmentType).cost;

export const costOfSteed = (steedType: SteedType): ResourceMap =>
  createSteed(steedType).cost;

export const costOfSpawnPeasant = (): ResourceMap =>
  peasantSpawnCost();

export const costOfTrainPriest = (): ResourceMap =>
  priestTrainCost();

export const costOfSummonArchAngel = (): ResourceMap =>
  archAngelSummonCost();

export const costOfResearch = (researchType: ResearchType): ResourceMap =>
  researchCostOf(researchType);

export const costOfHeal = (): ResourceMap =>
  createResourceMap({ faith: 1 });

// ============================================
// AFFORDABILITY & PAYMENT
// ============================================

export const canAffordCost = (player: Player, cost: ResourceMap): boolean =>
  playerCanAfford(player, cost);

export const payForCost = (player: Player, cost: ResourceMap): Player =>
  playerPay(player, cost);

export const collectResources = (player: Player, resources: ResourceMap): Player =>
  playerCollect(player, resources);

// ============================================
// PRODUCTION
// ============================================

/**
 * Calculate total resource production for a player at dawn/dusk.
 */
export const calculateProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
  research: Research,
): ResourceMap => {
  const houseProduction = calculateHouseProduction(playerType, tiles, research);
  const churchProduction = calculateChurchProduction(playerType, tiles);
  const fishingProduction = calculateFishingProduction(playerType, tiles);

  return addResources(addResources(houseProduction, churchProduction), fishingProduction);
};

const calculateHouseProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
  research: Research,
): ResourceMap => {
  const housesWithPeasants = tiles.filter(
    (tile) =>
      tile.building?.type === BuildingType.house &&
      tile.building.owner === playerType &&
      tile.piece !== null &&
      tile.piece.kind === PieceKind.peasant &&
      tile.piece.owner === playerType,
  );

  const producedTileKeys = new Set<string>();

  return housesWithPeasants.reduce((total, houseTile) => {
    const neighbors = hex.findNeighbors(houseTile, tiles as Tile[]);
    return neighbors.reduce((acc, neighbor) => {
      const tileKey = `${neighbor.row},${neighbor.column}`;
      if (producedTileKeys.has(tileKey)) {
        return acc;
      }
      const production = tileProduction(neighbor, research);
      if (production !== null) {
        producedTileKeys.add(tileKey);
        return addResources(acc, production);
      }
      return acc;
    }, total);
  }, createResourceMap({}));
};

const tileProduction = (
  tile: Tile,
  research: Research,
): ResourceMap | null => {
  if (tile.landscape === null) {
    return null;
  }
  switch (tile.landscape.type) {
    case LandscapeType.farm:
      return createResourceMap({ food: 1 });
    case LandscapeType.tree:
      return createResourceMap({ wood: 1 });
    case LandscapeType.mountain:
      return createResourceMap({
        stone: 1,
        iron: research.hasMiningII ? 1 : 0,
        gold: research.hasMiningIII ? 1 : 0,
      });
    default:
      return null;
  }
};

const calculateChurchProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
): ResourceMap => {
  const churchesWithPriests = tiles.filter(
    (tile) =>
      tile.building?.type === BuildingType.church &&
      tile.building.owner === playerType &&
      tile.piece !== null &&
      tile.piece.kind === PieceKind.priest &&
      tile.piece.owner === playerType,
  );

  return createResourceMap({ faith: churchesWithPriests.length });
};

const calculateFishingProduction = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
): ResourceMap => {
  const boatTilesWithPeasants = tiles.filter(
    (tile) =>
      tile.landscape?.type === LandscapeType.water &&
      tile.piece !== null &&
      tile.piece.kind === PieceKind.peasant &&
      tile.piece.owner === playerType &&
      tile.piece.steed?.type === "boat",
  );

  const fishingBoats = boatTilesWithPeasants.filter((boatTile) => {
    const neighbors = hex.findNeighbors(boatTile, tiles as Tile[]);
    return neighbors.every(
      (neighbor) => neighbor.landscape?.type === LandscapeType.water,
    );
  });

  return createResourceMap({ food: fishingBoats.length });
};

/**
 * Count the number of priests praying in churches for a player.
 */
export const countPrayingPriests = (
  playerType: PlayerType,
  tiles: ReadonlyArray<Tile>,
): number =>
  tiles.filter(
    (tile) =>
      tile.building?.type === BuildingType.church &&
      tile.building.owner === playerType &&
      tile.piece !== null &&
      tile.piece.kind === PieceKind.priest &&
      tile.piece.owner === playerType,
  ).length;

// ============================================
// PRODUCTION TRIGGER (game-level)
// ============================================

/**
 * Apply production for a player — called at dawn (day) or dusk (night).
 */
export const triggerProduction = (game: Game, playerType: PlayerType): Game => {
  const player = playerType === "day" ? game.dayPlayer : game.nightPlayer;
  const production = calculateProduction(playerType, game.tiles, player.research);
  const updatedPlayer = collectResources(player, production);
  return playerType === "day"
    ? { ...game, dayPlayer: updatedPlayer }
    : { ...game, nightPlayer: updatedPlayer };
};
