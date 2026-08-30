/**
 * Resource engine — handles all resource-related logic:
 * - Production calculation (what tiles produce at dawn/dusk)
 * - Cost validation and payment
 * - Resource collection
 * - All cost lookups centralized
 */

import { BuildingType, buildingCostOf } from "@shared/building/index.ts";
import { createEquipment, type EquipmentType } from "@shared/equipment/index.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import {
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
  type ResourceMap,
} from "@shared/player/resource-map.ts";
import { researchCostOf, type ResearchType } from "@shared/research/index.ts";
import { createSteed, type SteedType } from "@shared/steed/index.ts";
import type { Game } from "@shared/game/types.ts";
import { getPlayer, withPlayer } from "@shared/game/state.ts";

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

// Production rules live in the production module; re-exported here so the
// engine keeps a single import for everything resource-related.
export { calculateProduction, countPrayingPriests } from "@shared/production/index.ts";
import { calculateProduction } from "@shared/production/index.ts";

// ============================================
// PRODUCTION TRIGGER (game-level)
// ============================================

/**
 * Apply production for a player — called at dawn (day) or dusk (night).
 */
export const triggerProduction = (game: Game, playerType: PlayerType): Game => {
  const player = getPlayer(game, playerType);
  const production = calculateProduction(playerType, game.tiles, player.research);
  const updatedPlayer = collectResources(player, production);
  return withPlayer(game, playerType, updatedPlayer);
};
