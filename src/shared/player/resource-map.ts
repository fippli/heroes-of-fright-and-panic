export class ResourceMap {
  readonly wood: number;
  readonly gold: number;
  readonly stone: number;
  readonly food: number;

  constructor({
    wood = 0,
    gold = 0,
    stone = 0,
    food = 0,
  }: {
    wood?: number;
    gold?: number;
    stone?: number;
    food?: number;
  }) {
    this.wood = wood;
    this.gold = gold;
    this.stone = stone;
    this.food = food;
  }

  add(resourceMap: ResourceMap): ResourceMap {
    return new ResourceMap({
      wood: this.wood + resourceMap.wood,
      gold: this.gold + resourceMap.gold,
      stone: this.stone + resourceMap.stone,
      food: this.food + resourceMap.food,
    });
  }

  subtract(resourceMap: ResourceMap): ResourceMap {
    return new ResourceMap({
      wood: this.wood - resourceMap.wood,
      gold: this.gold - resourceMap.gold,
      stone: this.stone - resourceMap.stone,
      food: this.food - resourceMap.food,
    });
  }
}
