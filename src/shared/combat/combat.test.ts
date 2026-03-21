import { describe, it, expect } from "vitest";
import { Building } from "@shared/building/index.ts";
import { Equipment } from "@shared/equipment/index.ts";
import { Piece } from "@shared/piece/index.ts";
import { resolveCombat } from "./index.ts";

describe("Combat", () => {
  describe("piece vs piece", () => {
    it("peasant (1 atk) kills peasant (1 hp, 0 def)", () => {
      const attacker = Piece.peasant("day");
      const target = Piece.peasant("night");
      const result = resolveCombat(attacker, { kind: "piece", piece: target });

      expect(result.targetKind).toBe("piece");
      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
        expect(result.survivingPiece).toBeNull();
      }
    });

    it("peasant (1 atk) hits defender (1 hp, 1 def): defense absorbs, piece survives", () => {
      const attacker = Piece.peasant("day");
      const defender = Piece.peasant("night").withEquipment(Equipment.shield());
      const result = resolveCombat(attacker, { kind: "piece", piece: defender });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(false);
        expect(result.survivingPiece).not.toBeNull();
        expect(result.survivingPiece!.defense).toBe(0);
        expect(result.survivingPiece!.hearts).toBe(1);
      }
    });

    it("swordsman (2 atk) kills defender (1 hp, 1 def)", () => {
      const swordsman = Piece.peasant("day").withEquipment(Equipment.sword());
      const defender = Piece.peasant("night").withEquipment(Equipment.shield());
      const result = resolveCombat(swordsman, { kind: "piece", piece: defender });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("swordsman (2 atk) kills soldier (1 hp, 1 def)", () => {
      const swordsman = Piece.peasant("day").withEquipment(Equipment.sword());
      const soldier = Piece.peasant("night")
        .withEquipment(Equipment.sword())
        .withEquipment(Equipment.shield());
      const result = resolveCombat(swordsman, { kind: "piece", piece: soldier });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("arch angel (3 atk) damages king (3 hp, 1 def): king survives at 1 hp", () => {
      const angel = Piece.archAngel("day");
      const king = Piece.king("night");
      const result = resolveCombat(angel, { kind: "piece", piece: king });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(false);
        expect(result.survivingPiece!.hearts).toBe(1);
        expect(result.survivingPiece!.defense).toBe(0);
      }
    });

    it("arch angel (3 atk) kills peasant instantly", () => {
      const angel = Piece.archAngel("day");
      const peasant = Piece.peasant("night");
      const result = resolveCombat(angel, { kind: "piece", piece: peasant });

      if (result.targetKind === "piece") {
        expect(result.destroyed).toBe(true);
      }
    });
  });

  describe("piece vs building", () => {
    it("peasant (1 atk) cannot destroy house (1 defense)", () => {
      const peasant = Piece.peasant("day");
      const house = Building.house("night");
      const result = resolveCombat(peasant, { kind: "building", building: house });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(false);
      }
    });

    it("swordsman (2 atk) destroys house (1 defense)", () => {
      const swordsman = Piece.peasant("day").withEquipment(Equipment.sword());
      const house = Building.house("night");
      const result = resolveCombat(swordsman, { kind: "building", building: house });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("arch angel (3 atk) destroys castle (1 defense)", () => {
      const angel = Piece.archAngel("day");
      const castle = Building.castle("night");
      const result = resolveCombat(angel, { kind: "building", building: castle });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(true);
      }
    });

    it("peasant (1 atk) cannot destroy wall (1 defense)", () => {
      const peasant = Piece.peasant("day");
      const wall = Building.wall("night");
      const result = resolveCombat(peasant, { kind: "building", building: wall });

      if (result.targetKind === "building") {
        expect(result.destroyed).toBe(false);
      }
    });
  });
});
