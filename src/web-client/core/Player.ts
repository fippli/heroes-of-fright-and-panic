import { compose } from "../utils/compose";
import { BuildingType } from "./Building";
import { PieceType } from "./Piece";
import { ResourceMap } from "./ResourceMap";
import type { Tile } from "./Tile";

export class Player {
  type: "day" | "night";
  inventory: string[] = ["axe"];
  resources: ResourceMap = new ResourceMap({});

  constructor({ type }: { type: "day" | "night" }) {
    this.type = type;
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
      (xs) => xs.map((tile) => tile.getNeighbors(tiles)).flat(),
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
