import { ResourceMap } from "@shared/player/resource-map.ts";
import { Research } from "@shared/research/index.ts";
import type { PlayerType } from "@shared/piece/index.ts";

export class Player {
  readonly type: PlayerType;
  readonly resources: ResourceMap;
  readonly research: Research;

  constructor({
    type,
    resources,
    research,
  }: {
    type: PlayerType;
    resources?: ResourceMap;
    research?: Research;
  }) {
    this.type = type;
    this.resources = resources ?? new ResourceMap({});
    this.research = research ?? new Research({});
  }

  withResources(resources: ResourceMap): Player {
    return new Player({
      type: this.type,
      resources,
      research: this.research,
    });
  }

  withResearch(research: Research): Player {
    return new Player({
      type: this.type,
      resources: this.resources,
      research,
    });
  }

  collect(loot: ResourceMap): Player {
    return this.withResources(this.resources.add(loot));
  }

  canAfford(cost: ResourceMap): boolean {
    return this.resources.canAfford(cost);
  }

  pay(cost: ResourceMap): Player {
    return this.withResources(this.resources.subtract(cost));
  }
}
