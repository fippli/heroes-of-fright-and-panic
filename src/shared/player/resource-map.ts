export class ResourceMap {
  readonly wood: number;
  readonly stone: number;
  readonly iron: number;
  readonly gold: number;
  readonly food: number;
  readonly faith: number;

  constructor({
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
  }) {
    this.wood = wood;
    this.stone = stone;
    this.iron = iron;
    this.gold = gold;
    this.food = food;
    this.faith = faith;
  }

  add(resourceMap: ResourceMap): ResourceMap {
    return new ResourceMap({
      wood: this.wood + resourceMap.wood,
      stone: this.stone + resourceMap.stone,
      iron: this.iron + resourceMap.iron,
      gold: this.gold + resourceMap.gold,
      food: this.food + resourceMap.food,
      faith: this.faith + resourceMap.faith,
    });
  }

  subtract(resourceMap: ResourceMap): ResourceMap {
    return new ResourceMap({
      wood: this.wood - resourceMap.wood,
      stone: this.stone - resourceMap.stone,
      iron: this.iron - resourceMap.iron,
      gold: this.gold - resourceMap.gold,
      food: this.food - resourceMap.food,
      faith: this.faith - resourceMap.faith,
    });
  }

  canAfford(cost: ResourceMap): boolean {
    return (
      this.wood >= cost.wood &&
      this.stone >= cost.stone &&
      this.iron >= cost.iron &&
      this.gold >= cost.gold &&
      this.food >= cost.food &&
      this.faith >= cost.faith
    );
  }
}
