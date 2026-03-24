import type { Building } from "@shared/building/index.ts";
import {
  type Piece,
  getPieceAttack,
  pieceWithDamage,
  isPieceDead,
} from "@shared/piece/index.ts";

export type CombatTargetPiece = {
  readonly kind: "piece";
  readonly piece: Piece;
};

export type CombatTargetBuilding = {
  readonly kind: "building";
  readonly building: Building;
};

export type CombatTarget = CombatTargetPiece | CombatTargetBuilding;

export type PieceCombatResult = {
  readonly targetKind: "piece";
  readonly destroyed: boolean;
  readonly survivingPiece: Piece | null;
};

export type BuildingCombatResult = {
  readonly targetKind: "building";
  readonly destroyed: boolean;
};

export type CombatResult = PieceCombatResult | BuildingCombatResult;

/**
 * Resolve an attack from an attacker piece against a target.
 *
 * Combat rules from GAME.md:
 * - Damage is applied to defense first, then hearts
 * - Defense permanently absorbs damage (cannot be healed)
 * - When hearts reach 0, the piece is destroyed
 * - Buildings have 1 defense, 0 hearts. Requires attack > 1 to destroy.
 */
export const resolveCombat = (
  attacker: Piece,
  target: CombatTarget,
): CombatResult => {
  if (target.kind === "piece") {
    return resolvePieceCombat(attacker, target.piece);
  }
  return resolveBuildingCombat(attacker, target.building);
};

const resolvePieceCombat = (
  attacker: Piece,
  target: Piece,
): PieceCombatResult => {
  const damaged = pieceWithDamage(target, getPieceAttack(attacker));
  if (isPieceDead(damaged)) {
    return { targetKind: "piece", destroyed: true, survivingPiece: null };
  }
  return { targetKind: "piece", destroyed: false, survivingPiece: damaged };
};

const resolveBuildingCombat = (
  attacker: Piece,
  target: Building,
): BuildingCombatResult => {
  const destroyed = getPieceAttack(attacker) > target.defense;
  return { targetKind: "building", destroyed };
};
