import { LandscapeType } from "@shared/map/landscape.ts";
import { Equipment, EquipmentType } from "@shared/equipment/index.ts";
import { Steed } from "@shared/steed/index.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";

export type PlayerType = "day" | "night";

export enum PieceKind {
  peasant = "peasant",
  king = "king",
  priest = "priest",
  archAngel = "archAngel",
}

export class Piece {
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

  constructor({
    kind,
    owner,
    hearts,
    maxHearts,
    baseAttack,
    baseDefense = 0,
    baseView = 1,
    baseMove = 1,
    baseAttackRange = 1,
    equipment = [],
    steed = null,
    canEquip = true,
    canMountSteed = true,
  }: {
    kind: PieceKind;
    owner: PlayerType;
    hearts: number;
    maxHearts?: number;
    baseAttack: number;
    baseDefense?: number;
    baseView?: number;
    baseMove?: number;
    baseAttackRange?: number;
    equipment?: ReadonlyArray<Equipment>;
    steed?: Steed | null;
    canEquip?: boolean;
    canMountSteed?: boolean;
  }) {
    this.kind = kind;
    this.owner = owner;
    this.hearts = hearts;
    this.maxHearts = maxHearts ?? hearts;
    this.baseAttack = baseAttack;
    this.baseDefense = baseDefense;
    this.baseView = baseView;
    this.baseMove = baseMove;
    this.baseAttackRange = baseAttackRange;
    this.equipment = equipment;
    this.steed = steed;
    this.canEquip = canEquip;
    this.canMountSteed = canMountSteed;
  }

  static peasant(owner: PlayerType): Piece {
    return new Piece({
      kind: PieceKind.peasant,
      owner,
      hearts: 1,
      baseAttack: 1,
      baseDefense: 0,
      baseView: 1,
      baseMove: 1,
      baseAttackRange: 1,
    });
  }

  static king(owner: PlayerType): Piece {
    return new Piece({
      kind: PieceKind.king,
      owner,
      hearts: 3,
      baseAttack: 1,
      baseDefense: 1,
      baseView: 2,
      baseMove: 1,
      baseAttackRange: 1,
      canEquip: false,
    });
  }

  static priest(owner: PlayerType): Piece {
    return new Piece({
      kind: PieceKind.priest,
      owner,
      hearts: 3,
      baseAttack: 0,
      baseDefense: 0,
      baseView: 1,
      baseMove: 1,
      baseAttackRange: 1,
      canEquip: false,
    });
  }

  static archAngel(owner: PlayerType): Piece {
    return new Piece({
      kind: PieceKind.archAngel,
      owner,
      hearts: 3,
      baseAttack: 3,
      baseDefense: 3,
      baseView: 3,
      baseMove: 3,
      baseAttackRange: 1,
      canEquip: false,
      canMountSteed: false,
    });
  }

  static spawnCost(): ResourceMap {
    return new ResourceMap({ food: 1 });
  }

  static priestCost(): ResourceMap {
    return new ResourceMap({ gold: 1 });
  }

  static archAngelCost(): ResourceMap {
    return new ResourceMap({ faith: 100 });
  }

  get attack(): number {
    const equipmentBonus = this.equipment.reduce(
      (sum, equip) => sum + equip.attackBonus,
      0,
    );
    return this.baseAttack + equipmentBonus;
  }

  get defense(): number {
    const equipmentBonus = this.equipment.reduce(
      (sum, equip) => sum + equip.defenseBonus,
      0,
    );
    return this.baseDefense + equipmentBonus;
  }

  get view(): number {
    const steedBonus = this.steed !== null ? this.steed.viewBonus : 0;
    return this.baseView + steedBonus;
  }

  get move(): number {
    const steedBonus = this.steed !== null ? this.steed.moveBonus : 0;
    return this.baseMove + steedBonus;
  }

  get attackRange(): number {
    const hasBow = this.hasEquipment(EquipmentType.bow);
    if (!hasBow) {
      return this.baseAttackRange;
    }
    const bowRangeBonus = this.equipment
      .filter((equip) => equip.type === EquipmentType.bow)
      .reduce((sum, equip) => sum + equip.attackRangeBonus, 0);
    const steedBowBonus =
      this.steed !== null && hasBow ? this.steed.bowRangeBonus : 0;
    return this.baseAttackRange + bowRangeBonus + steedBowBonus;
  }

  get totalHp(): number {
    return this.hearts + this.defense;
  }

  get walkableLandscape(): ReadonlyArray<LandscapeType> {
    const base = [LandscapeType.grass, LandscapeType.sand, LandscapeType.farm];
    const canWalkTrees = this.equipment.some((equip) => equip.canWalkOnTrees);
    const canWalkWater = this.steed?.enablesWaterTravel === true;
    return [
      ...base,
      ...(canWalkTrees ? [LandscapeType.tree] : []),
      ...(canWalkWater ? [LandscapeType.water] : []),
    ];
  }

  hasEquipment(equipmentType: EquipmentType): boolean {
    return this.equipment.some((equip) => equip.type === equipmentType);
  }

  withEquipment(newEquipment: Equipment): Piece {
    if (!this.canEquip) {
      return this;
    }
    if (this.hasEquipment(newEquipment.type)) {
      return this;
    }
    return new Piece({
      ...this.toConstructorArgs(),
      equipment: [...this.equipment, newEquipment],
    });
  }

  withSteed(newSteed: Steed): Piece {
    if (!this.canMountSteed) {
      return this;
    }
    if (this.steed !== null) {
      return this;
    }
    return new Piece({
      ...this.toConstructorArgs(),
      steed: newSteed,
    });
  }

  withDamage(damage: number): Piece {
    const totalDefense = this.defense;
    const defenseAbsorbed = Math.min(totalDefense, damage);
    const remainingDamage = damage - defenseAbsorbed;
    const newBaseDefense = Math.max(0, this.baseDefense - defenseAbsorbed);
    const newHearts = Math.max(0, this.hearts - remainingDamage);
    // Remove equipment that contributed defense if all defense is consumed
    const updatedEquipment =
      defenseAbsorbed >= totalDefense
        ? this.equipment.filter((equip) => equip.defenseBonus === 0)
        : this.equipment;
    return new Piece({
      ...this.toConstructorArgs(),
      hearts: newHearts,
      baseDefense: newBaseDefense,
      equipment: updatedEquipment,
    });
  }

  withHealing(amount: number): Piece {
    const newHearts = Math.min(this.maxHearts, this.hearts + amount);
    return new Piece({
      ...this.toConstructorArgs(),
      hearts: newHearts,
    });
  }

  get isAlive(): boolean {
    return this.hearts > 0;
  }

  get isDead(): boolean {
    return this.hearts <= 0;
  }

  isOwnedBy(playerType: PlayerType): boolean {
    return this.owner === playerType;
  }

  private toConstructorArgs() {
    return {
      kind: this.kind,
      owner: this.owner,
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      baseAttack: this.baseAttack,
      baseDefense: this.baseDefense,
      baseView: this.baseView,
      baseMove: this.baseMove,
      baseAttackRange: this.baseAttackRange,
      equipment: this.equipment,
      steed: this.steed,
      canEquip: this.canEquip,
      canMountSteed: this.canMountSteed,
    };
  }
}
