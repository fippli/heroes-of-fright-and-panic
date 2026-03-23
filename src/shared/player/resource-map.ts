export type ResourceMap = {
  readonly wood: number;
  readonly stone: number;
  readonly iron: number;
  readonly gold: number;
  readonly food: number;
  readonly faith: number;
};

export const createResourceMap = ({
  wood = 0,
  stone = 0,
  iron = 0,
  gold = 0,
  food = 0,
  faith = 0,
}: {
  wood?: number;
  stone?: number;
  iron?: number;
  gold?: number;
  food?: number;
  faith?: number;
} = {}): ResourceMap => ({
  wood,
  stone,
  iron,
  gold,
  food,
  faith,
});

export const addResources = (
  a: ResourceMap,
  b: ResourceMap,
): ResourceMap => ({
  wood: a.wood + b.wood,
  stone: a.stone + b.stone,
  iron: a.iron + b.iron,
  gold: a.gold + b.gold,
  food: a.food + b.food,
  faith: a.faith + b.faith,
});

export const subtractResources = (
  a: ResourceMap,
  b: ResourceMap,
): ResourceMap => ({
  wood: a.wood - b.wood,
  stone: a.stone - b.stone,
  iron: a.iron - b.iron,
  gold: a.gold - b.gold,
  food: a.food - b.food,
  faith: a.faith - b.faith,
});

export const canAfford = (
  resources: ResourceMap,
  cost: ResourceMap,
): boolean =>
  resources.wood >= cost.wood &&
  resources.stone >= cost.stone &&
  resources.iron >= cost.iron &&
  resources.gold >= cost.gold &&
  resources.food >= cost.food &&
  resources.faith >= cost.faith;
