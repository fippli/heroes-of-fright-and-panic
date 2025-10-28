export class ResourceMap {
  wood: number;
  gold: number;
  stone: number;
  food: number;

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

  add(resourceMap: ResourceMap) {
    this.wood += resourceMap.wood;
    this.gold += resourceMap.gold;
    this.stone += resourceMap.stone;
    this.food += resourceMap.food;
  }

  subtract(resourceMap: ResourceMap) {
    this.wood -= resourceMap.wood;
    this.gold -= resourceMap.gold;
    this.stone -= resourceMap.stone;
    this.food -= resourceMap.food;
  }
}
