import { ResourceMap } from "./ResourceMap";

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
    return Object.keys(cost).every(
      (key) =>
        this.resources[key as keyof ResourceMap] >=
        cost[key as keyof ResourceMap],
    );
  }

  pay(cost: ResourceMap) {
    this.resources.subtract(cost);
  }
}
