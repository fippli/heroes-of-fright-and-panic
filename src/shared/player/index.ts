import { compose } from "../utils/compose.ts";
import { PieceType } from "@shared/piece/index.ts";
import { BuildingType } from "@shared/building/index.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";
import type { Tile } from "@shared/map/tile.ts";
import { GameMap } from "@shared/map/map.ts";

export class Player {
  readonly type: "day" | "night";
  readonly resources: ResourceMap;

  constructor({
    type,
    resources,
  }: {
    type: "day" | "night";
    resources?: ResourceMap;
  }) {
    this.type = type;
    this.resources = resources ?? new ResourceMap({});
  }

  withResources(resources: ResourceMap): Player {
    return new Player({ type: this.type, resources });
  }

  collect(loot: ResourceMap): Player {
    return this.withResources(this.resources.add(loot));
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

  pay(cost: ResourceMap): Player {
    return this.withResources(this.resources.subtract(cost));
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
