import { LandscapeType } from "@shared/map/landscape.ts";
import { type Equipment, EquipmentType } from "@shared/equipment/index.ts";
import type { Steed } from "@shared/steed/index.ts";
import {
  createResourceMap,
  type ResourceMap,
} from "@shared/player/resource-map.ts";

export type PlayerType = "day" | "night";

export enum PieceKind {
  peasant = "peasant",
  king = "king",
  priest = "priest",
  archAngel = "archAngel",
}

export type Piece = {
  readonly kind: PieceKind;
  readonly owner: PlayerType;
  readonly hearts: number;
  readonly maxHearts: number;
  readonly baseAttack: number;
  readonly baseDefense: number;
  readonly baseView: number;
  readonly baseMove: number;
  readonly baseAttackRange: number;
  readonly equipment: ReadonlyArray<Equipment>;
  readonly steed: Steed | null;
  readonly canEquip: boolean;
  readonly canMountSteed: boolean;
  /** Set once the piece has used its action this phase */
  readonly acted?: boolean;
};

// ============================================
// FACTORY FUNCTIONS
// ============================================

export const createPeasant = (owner: PlayerType): Piece => ({
  kind: PieceKind.peasant,
  owner,
  hearts: 1,
  maxHearts: 1,
  baseAttack: 1,
  baseDefense: 0,
  baseView: 1,
  baseMove: 1,
  baseAttackRange: 1,
  equipment: [],
  steed: null,
  canEquip: true,
  canMountSteed: true,
});

export const createKing = (owner: PlayerType): Piece => ({
  kind: PieceKind.king,
  owner,
  hearts: 3,
  maxHearts: 3,
  baseAttack: 1,
  baseDefense: 1,
  baseView: 2,
  baseMove: 1,
  baseAttackRange: 1,
  equipment: [],
  steed: null,
  canEquip: false,
  canMountSteed: true,
});

export const createPriest = (owner: PlayerType): Piece => ({
  kind: PieceKind.priest,
  owner,
  hearts: 3,
  maxHearts: 3,
  baseAttack: 0,
  baseDefense: 0,
  baseView: 1,
  baseMove: 1,
  baseAttackRange: 1,
  equipment: [],
  steed: null,
  canEquip: false,
  canMountSteed: true,
});

export const createArchAngel = (owner: PlayerType): Piece => ({
  kind: PieceKind.archAngel,
  owner,
  hearts: 3,
  maxHearts: 3,
  baseAttack: 3,
  baseDefense: 3,
  baseView: 3,
  baseMove: 3,
  baseAttackRange: 1,
  equipment: [],
  steed: null,
  canEquip: false,
  canMountSteed: false,
});

// ============================================
// COST FUNCTIONS
// ============================================

export const peasantSpawnCost = (): ResourceMap =>
  createResourceMap({ food: 1 });

export const priestTrainCost = (): ResourceMap =>
  createResourceMap({ gold: 1 });

export const archAngelSummonCost = (): ResourceMap =>
  createResourceMap({ faith: 100 });

// ============================================
// COMPUTED VALUE FUNCTIONS
// ============================================

export const getPieceAttack = (piece: Piece): number => {
  const equipmentBonus = piece.equipment.reduce(
    (sum, equip) => sum + equip.attackBonus,
    0,
  );
  return piece.baseAttack + equipmentBonus;
};

export const getPieceDefense = (piece: Piece): number => {
  const equipmentBonus = piece.equipment.reduce(
    (sum, equip) => sum + equip.defenseBonus,
    0,
  );
  return piece.baseDefense + equipmentBonus;
};

export const getPieceView = (piece: Piece): number => {
  const steedBonus = piece.steed !== null ? piece.steed.viewBonus : 0;
  return piece.baseView + steedBonus;
};

/**
 * A piece's effective vision when standing on a friendly building: its own view
 * amplified up to the building's view range (a peasant in a tower sees as far
 * as the tower). Buildings grant no vision of their own when unoccupied.
 */
export const amplifiedView = (
  pieceView: number,
  buildingViewRange?: number,
): number => Math.max(pieceView, buildingViewRange ?? 0);

export const getPieceMove = (piece: Piece): number => {
  const steedBonus = piece.steed !== null ? piece.steed.moveBonus : 0;
  return piece.baseMove + steedBonus;
};

export const getPieceAttackRange = (piece: Piece): number => {
  const hasBow = pieceHasEquipment(piece, EquipmentType.bow);
  if (!hasBow) {
    return piece.baseAttackRange;
  }
  const bowRangeBonus = piece.equipment
    .filter((equip) => equip.type === EquipmentType.bow)
    .reduce((sum, equip) => sum + equip.attackRangeBonus, 0);
  const steedBowBonus =
    piece.steed !== null && hasBow ? piece.steed.bowRangeBonus : 0;
  return piece.baseAttackRange + bowRangeBonus + steedBowBonus;
};

export const getPieceTotalHp = (piece: Piece): number =>
  piece.hearts + getPieceDefense(piece);

export const getWalkableLandscape = (
  piece: Piece,
): ReadonlyArray<LandscapeType> => {
  const base = [LandscapeType.grass, LandscapeType.sand, LandscapeType.farm];
  // Forests and mountains are never passable; a boat opens up water.
  const canWalkWater = piece.steed?.enablesWaterTravel === true;
  return [...base, ...(canWalkWater ? [LandscapeType.water] : [])];
};

export const isPieceAlive = (piece: Piece): boolean => piece.hearts > 0;

export const isPieceDead = (piece: Piece): boolean => piece.hearts <= 0;

// ============================================
// QUERY / TRANSFORMATION FUNCTIONS
// ============================================

export const pieceHasEquipment = (
  piece: Piece,
  equipmentType: EquipmentType,
): boolean => piece.equipment.some((equip) => equip.type === equipmentType);

export const pieceWithEquipment = (
  piece: Piece,
  newEquipment: Equipment,
): Piece => {
  if (!piece.canEquip) {
    return piece;
  }
  if (pieceHasEquipment(piece, newEquipment.type)) {
    return piece;
  }
  return {
    ...piece,
    equipment: [...piece.equipment, newEquipment],
  };
};

export const pieceWithSteed = (piece: Piece, newSteed: Steed): Piece => {
  if (!piece.canMountSteed) {
    return piece;
  }
  if (piece.steed !== null) {
    return piece;
  }
  return {
    ...piece,
    steed: newSteed,
  };
};

export const pieceWithDamage = (piece: Piece, damage: number): Piece => {
  const totalDefense = getPieceDefense(piece);
  const defenseAbsorbed = Math.min(totalDefense, damage);
  const remainingDamage = damage - defenseAbsorbed;
  const newBaseDefense = Math.max(0, piece.baseDefense - defenseAbsorbed);
  const newHearts = Math.max(0, piece.hearts - remainingDamage);
  // Remove equipment that contributed defense if all defense is consumed
  const updatedEquipment =
    defenseAbsorbed >= totalDefense
      ? piece.equipment.filter((equip) => equip.defenseBonus === 0)
      : piece.equipment;
  return {
    ...piece,
    hearts: newHearts,
    baseDefense: newBaseDefense,
    equipment: updatedEquipment,
  };
};

export const pieceWithHealing = (piece: Piece, amount: number): Piece => {
  const newHearts = Math.min(piece.maxHearts, piece.hearts + amount);
  return {
    ...piece,
    hearts: newHearts,
  };
};
