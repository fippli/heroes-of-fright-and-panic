import { compose } from "../utils/compose";
import { PieceType } from "@shared/piece";
import { BuildingType } from "@shared/building";
import { ResourceMap } from "@shared/player/resource-map";
import type { Tile } from "@shared/map/tile";
import { GameMap } from "@shared/map/map";

export class Player {
  type: "day" | "night";
  resources: ResourceMap = new ResourceMap({});

  constructor({
    type,
    resources,
  }: {
    type: "day" | "night";
    resources: ResourceMap;
  }) {
    this.type = type;
    this.resources = resources;
  }

  collect(loot: ResourceMap) {
    this.resources.add(loot);
  }

  canAfford(cost: ResourceMap) {
    const canAfford = Object.keys(cost).every(
      (key) =>
        this.resources[key as keyof ResourceMap] >=
        cost[key as keyof ResourceMap],
    );

    if (!canAfford) {
      console.log("Cannot afford", cost);
    }

    return canAfford;
  }

  pay(cost: ResourceMap) {
    this.resources.subtract(cost);
  }

  produce(tiles: Tile[]): ResourceMap {
    const activeFarms = compose<Tile[]>(
      (xs) => xs.filter((tile) => tile.piece?.type === PieceType.peasant),
      (xs) => xs.filter((tile) => tile.piece?.owner === this),
      (xs) => xs.filter((tile) => tile.building?.type === BuildingType.house),
      (xs) => xs.map((tile) => GameMap.findNeighbors(tile, tiles)).flat(),
      (xs) => xs.filter((tile) => tile.building?.type === BuildingType.farm),
    )(tiles);

    console.log(activeFarms);

    const result = new ResourceMap({
      food: activeFarms.reduce(
        (acc, farm) => acc + farm.building!.production.food,
        0,
      ),
    });

    console.log(result);

    return result;
  }
}
