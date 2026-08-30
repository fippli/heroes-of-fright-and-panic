import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum EquipmentType {
  sword = "sword",
  shield = "shield",
  bow = "bow",
}

export type Equipment = {
  readonly type: EquipmentType;
  readonly cost: ResourceMap;
  readonly attackBonus: number;
  readonly defenseBonus: number;
  readonly attackRangeBonus: number;
};

export const createSword = (): Equipment => ({
  type: EquipmentType.sword,
  cost: createResourceMap({ iron: 1 }),
  attackBonus: 1,
  defenseBonus: 0,
  attackRangeBonus: 0,
});

export const createShield = (): Equipment => ({
  type: EquipmentType.shield,
  cost: createResourceMap({ wood: 1 }),
  attackBonus: 0,
  defenseBonus: 1,
  attackRangeBonus: 0,
});

export const createBow = (): Equipment => ({
  type: EquipmentType.bow,
  cost: createResourceMap({ wood: 1, iron: 1 }),
  attackBonus: 0,
  defenseBonus: 0,
  attackRangeBonus: 1,
});

export const createEquipment = (equipmentType: EquipmentType): Equipment => {
  switch (equipmentType) {
    case EquipmentType.sword:
      return createSword();
    case EquipmentType.shield:
      return createShield();
    case EquipmentType.bow:
      return createBow();
  }
};
