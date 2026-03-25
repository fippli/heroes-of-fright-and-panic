import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum LandscapeType {
  grass = "grass",
  farm = "farm",
  tree = "tree",
  sand = "sand",
  water = "water",
  unexplored = "unexplored",
  mountain = "mountain",
}

export type Landscape = {
  readonly type: LandscapeType;
  readonly lootDrop?: ResourceMap;
};

export const grass = (): Landscape => ({
  type: LandscapeType.grass,
});

export const farm = (): Landscape => ({
  type: LandscapeType.farm,
});

export const water = (): Landscape => ({
  type: LandscapeType.water,
});

export const sand = (): Landscape => ({
  type: LandscapeType.sand,
});

export const mountain = (): Landscape => ({
  type: LandscapeType.mountain,
  lootDrop: createResourceMap({ stone: 1 }),
});

export const tree = (): Landscape => ({
  type: LandscapeType.tree,
  lootDrop: createResourceMap({ wood: 1 }),
});

export const unexplored = (): Landscape => ({
  type: LandscapeType.unexplored,
});

