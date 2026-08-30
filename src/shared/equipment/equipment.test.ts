import { createPeasant, pieceWithEquipment, getPieceDefense } from "@shared/piece/index.ts";
import { describe, it, expect } from "vitest";
import { createSword, createShield, createBow, EquipmentType, createEquipment } from "./index.ts";

describe("armour", () => {
  it("each piece adds one defence and costs iron", () => {
    expect(createEquipment(EquipmentType.helmet).defenseBonus).toBe(1);
    expect(createEquipment(EquipmentType.torso).defenseBonus).toBe(1);
    expect(createEquipment(EquipmentType.legs).defenseBonus).toBe(1);
    expect(createEquipment(EquipmentType.helmet).cost.iron).toBe(1);
    expect(createEquipment(EquipmentType.torso).cost.iron).toBe(2);
    expect(createEquipment(EquipmentType.legs).cost.iron).toBe(1);
  });

  it("a fully armoured peasant with a shield has 4 defence", () => {
    const armoured = [EquipmentType.helmet, EquipmentType.torso, EquipmentType.legs, EquipmentType.shield]
      .map(createEquipment)
      .reduce((piece, item) => pieceWithEquipment(piece, item), createPeasant("day"));
    expect(getPieceDefense(armoured)).toBe(4);
  });
});

describe("Equipment", () => {
  describe("sword", () => {
    it("costs 1 iron", () => {
      const sword = createSword();
      expect(sword.cost.iron).toBe(1);
      expect(sword.cost.wood).toBe(0);
    });

    it("gives +1 attack", () => {
      const sword = createSword();
      expect(sword.attackBonus).toBe(1);
      expect(sword.defenseBonus).toBe(0);
      expect(sword.attackRangeBonus).toBe(0);
    });

    it("has type sword", () => {
      const sword = createSword();
      expect(sword.type).toBe(EquipmentType.sword);
    });
  });

  describe("shield", () => {
    it("costs 1 wood", () => {
      const shield = createShield();
      expect(shield.cost.wood).toBe(1);
      expect(shield.cost.iron).toBe(0);
    });

    it("gives +1 defense", () => {
      const shield = createShield();
      expect(shield.defenseBonus).toBe(1);
      expect(shield.attackBonus).toBe(0);
    });
  });

  describe("bow", () => {
    it("costs 1 wood and 1 iron", () => {
      const bow = createBow();
      expect(bow.cost.wood).toBe(1);
      expect(bow.cost.iron).toBe(1);
    });

    it("gives +1 attack range", () => {
      const bow = createBow();
      expect(bow.attackRangeBonus).toBe(1);
    });


    it("does not give attack or defense bonus", () => {
      const bow = createBow();
      expect(bow.attackBonus).toBe(0);
      expect(bow.defenseBonus).toBe(0);
    });
  });
});
