import { describe, it, expect } from "vitest";
import {
  createCastleBuilding,
  createHouseBuilding,
  createWallBuilding,
} from "@shared/building/index.ts";
import { createSword, createShield } from "@shared/equipment/index.ts";
import {
  createPeasant,
  createKing,
  createArchAngel,
  getPieceDefense,
  pieceWithEquipment,
} from "@shared/piece/index.ts";
import { resolveCombat } from "./index.ts";

describe("Combat", () => {
  describe("piece vs piece", () => {
    it("peasant (1 atk) kills peasant (1 hp, 0 def)", () => {
      const attacker = createPeasant("day");
      const target = createPeasant("night");
      const result = resolveCombat(attacker, { kind: "piece", piece: target });

      expect(result.targetKind).toBe("piece");
      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
        expect(result.survivingPiece).toBeNull();
      }
    });

    it("peasant (1 atk) hits defender (1 hp, 1 def): defense absorbs, piece survives", () => {
      const attacker = createPeasant("day");
      const defender = pieceWithEquipment(createPeasant("night"), createShield());
      const result = resolveCombat(attacker, { kind: "piece", piece: defender });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(false);
        expect(result.survivingPiece).not.toBeNull();
        expect(getPieceDefense(result.survivingPiece!)).toBe(0);
        expect(result.survivingPiece!.hearts).toBe(1);
      }
    });

    it("swordsman (2 atk) kills defender (1 hp, 1 def)", () => {
      const swordsman = pieceWithEquipment(createPeasant("day"), createSword());
      const defender = pieceWithEquipment(createPeasant("night"), createShield());
      const result = resolveCombat(swordsman, { kind: "piece", piece: defender });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("swordsman (2 atk) kills soldier (1 hp, 1 def)", () => {
      const swordsman = pieceWithEquipment(createPeasant("day"), createSword());
      const soldier = pieceWithEquipment(
        pieceWithEquipment(createPeasant("night"), createSword()),
        createShield(),
      );
      const result = resolveCombat(swordsman, { kind: "piece", piece: soldier });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("arch angel (3 atk) damages king (3 hp, 1 def): king survives at 1 hp", () => {
      const angel = createArchAngel("day");
      const king = createKing("night");
      const result = resolveCombat(angel, { kind: "piece", piece: king });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(false);
        expect(result.survivingPiece!.hearts).toBe(1);
        expect(getPieceDefense(result.survivingPiece!)).toBe(0);
      }
    });

    it("arch angel (3 atk) kills peasant instantly", () => {
      const angel = createArchAngel("day");
      const peasant = createPeasant("night");
      const result = resolveCombat(angel, { kind: "piece", piece: peasant });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
      }
    });
  });

  describe("piece vs building", () => {
    it("peasant (1 atk) cannot destroy house (1 defense)", () => {
      const peasant = createPeasant("day");
      const house = createHouseBuilding("night");
      const result = resolveCombat(peasant, { kind: "building", building: house });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(false);
      }
    });

    it("swordsman (2 atk) destroys house (1 defense)", () => {
      const swordsman = pieceWithEquipment(createPeasant("day"), createSword());
      const house = createHouseBuilding("night");
      const result = resolveCombat(swordsman, { kind: "building", building: house });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("arch angel (3 atk) destroys castle (1 defense)", () => {
      const angel = createArchAngel("day");
      const castle = createCastleBuilding("night");
      const result = resolveCombat(angel, { kind: "building", building: castle });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("peasant (1 atk) cannot destroy wall (1 defense)", () => {
      const peasant = createPeasant("day");
      const wall = createWallBuilding("night");
      const result = resolveCombat(peasant, { kind: "building", building: wall });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(false);
      }
    });
  });
});
