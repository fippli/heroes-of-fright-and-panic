import { ResourceMap } from "@shared/player/resource-map.ts";

export enum EquipmentType {
  sword = "sword",
  shield = "shield",
  bow = "bow",
}

export class Equipment {
  readonly type: EquipmentType;
  readonly cost: ResourceMap;
  readonly attackBonus: number;
  readonly defenseBonus: number;
  readonly attackRangeBonus: number;
  readonly canWalkOnTrees: boolean;

  constructor({
    type,
    cost,
    attackBonus = 0,
    defenseBonus = 0,
    attackRangeBonus = 0,
    canWalkOnTrees = false,
  }: {
    type: EquipmentType;
    cost: ResourceMap;
    attackBonus?: number;
    defenseBonus?: number;
    attackRangeBonus?: number;
    canWalkOnTrees?: boolean;
  }) {
    this.type = type;
    this.cost = cost;
    this.attackBonus = attackBonus;
    this.defenseBonus = defenseBonus;
    this.attackRangeBonus = attackRangeBonus;
    this.canWalkOnTrees = canWalkOnTrees;
  }

  static sword(): Equipment {
    return new Equipment({
      type: EquipmentType.sword,
      cost: new ResourceMap({ iron: 1 }),
      attackBonus: 1,
    });
  }

  static shield(): Equipment {
    return new Equipment({
      type: EquipmentType.shield,
      cost: new ResourceMap({ wood: 1 }),
      defenseBonus: 1,
    });
  }

  static bow(): Equipment {
    return new Equipment({
      type: EquipmentType.bow,
      cost: new ResourceMap({ wood: 1, iron: 1 }),
      attackRangeBonus: 1,
      canWalkOnTrees: true,
    });
  }
}
