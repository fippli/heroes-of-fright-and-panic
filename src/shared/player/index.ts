import {
  createResourceMap,
  addResources,
  subtractResources,
  canAfford,
  type ResourceMap,
} from "@shared/player/resource-map.ts";
import { createResearch, type Research } from "@shared/research/index.ts";
import type { PlayerType } from "@shared/piece/index.ts";

export type Player = {
  readonly type: PlayerType;
  readonly resources: ResourceMap;
  readonly research: Research;
};

export const createPlayer = ({
  type,
  resources,
  research,
}: {
  type: PlayerType;
  resources?: ResourceMap;
  research?: Research;
}): Player => ({
  type,
  resources: resources ?? createResourceMap(),
  research: research ?? createResearch(),
});

export const playerWithResources = (
  player: Player,
  resources: ResourceMap,
): Player => ({
  ...player,
  resources,
});

export const playerWithResearch = (
  player: Player,
  research: Research,
): Player => ({
  ...player,
  research,
});

export const playerCollect = (
  player: Player,
  loot: ResourceMap,
): Player =>
  playerWithResources(player, addResources(player.resources, loot));

export const playerCanAfford = (
  player: Player,
  cost: ResourceMap,
): boolean =>
  canAfford(player.resources, cost);

export const playerPay = (
  player: Player,
  cost: ResourceMap,
): Player =>
  playerWithResources(player, subtractResources(player.resources, cost));
