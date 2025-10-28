const woodElement = document.getElementById("wood") as HTMLDivElement;
const stoneElement = document.getElementById("stone") as HTMLDivElement;
const goldElement = document.getElementById("gold") as HTMLDivElement;
const foodElement = document.getElementById("food") as HTMLDivElement;

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

  render() {
    woodElement.textContent = this.wood.toString();
    stoneElement.textContent = this.stone.toString();
    goldElement.textContent = this.gold.toString();
    foodElement.textContent = this.food.toString();
  }
}
