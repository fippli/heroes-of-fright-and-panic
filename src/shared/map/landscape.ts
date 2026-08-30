
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
});

export const tree = (): Landscape => ({
  type: LandscapeType.tree,
});

export const unexplored = (): Landscape => ({
  type: LandscapeType.unexplored,
});

