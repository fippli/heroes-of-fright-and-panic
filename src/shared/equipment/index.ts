import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum EquipmentType {
  sword = "sword",
  shield = "shield",
  bow = "bow",
  helmet = "helmet",
  torso = "torso",
  legs = "legs",
}

/** Armour pieces: one defence each, paid in iron */
export const ARMOR_TYPES: ReadonlyArray<EquipmentType> = [EquipmentType.helmet, EquipmentType.torso, EquipmentType.legs];

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

const armor = (type: EquipmentType, iron: number): Equipment => ({
  type,
  cost: createResourceMap({ iron }),
  attackBonus: 0,
  defenseBonus: 1,
  attackRangeBonus: 0,
});

export const createHelmet = (): Equipment => armor(EquipmentType.helmet, 1);
export const createTorso = (): Equipment => armor(EquipmentType.torso, 2);
export const createLegs = (): Equipment => armor(EquipmentType.legs, 1);

export const createEquipment = (equipmentType: EquipmentType): Equipment => {
  switch (equipmentType) {
    case EquipmentType.sword:
      return createSword();
    case EquipmentType.shield:
      return createShield();
    case EquipmentType.bow:
      return createBow();
    case EquipmentType.helmet:
      return createHelmet();
    case EquipmentType.torso:
      return createTorso();
    case EquipmentType.legs:
      return createLegs();
  }
};
