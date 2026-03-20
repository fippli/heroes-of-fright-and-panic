import { describe, it, expect } from "vitest";
import { Equipment, EquipmentType } from "./index.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";

describe("Equipment", () => {
  describe("sword", () => {
    it("costs 1 iron", () => {
      const sword = Equipment.sword();
      expect(sword.cost.iron).toBe(1);
      expect(sword.cost.wood).toBe(0);
    });

    it("gives +1 attack", () => {
      const sword = Equipment.sword();
      expect(sword.attackBonus).toBe(1);
      expect(sword.defenseBonus).toBe(0);
      expect(sword.attackRangeBonus).toBe(0);
    });

    it("has type sword", () => {
      const sword = Equipment.sword();
      expect(sword.type).toBe(EquipmentType.sword);
    });
  });

  describe("shield", () => {
    it("costs 1 wood", () => {
      const shield = Equipment.shield();
      expect(shield.cost.wood).toBe(1);
      expect(shield.cost.iron).toBe(0);
    });

    it("gives +1 defense", () => {
      const shield = Equipment.shield();
      expect(shield.defenseBonus).toBe(1);
      expect(shield.attackBonus).toBe(0);
    });
  });

  describe("bow", () => {
    it("costs 1 wood and 1 iron", () => {
      const bow = Equipment.bow();
      expect(bow.cost.wood).toBe(1);
      expect(bow.cost.iron).toBe(1);
    });

    it("gives +1 attack range", () => {
      const bow = Equipment.bow();
      expect(bow.attackRangeBonus).toBe(1);
    });

    it("enables walking on trees", () => {
      const bow = Equipment.bow();
      expect(bow.canWalkOnTrees).toBe(true);
    });

    it("does not give attack or defense bonus", () => {
      const bow = Equipment.bow();
      expect(bow.attackBonus).toBe(0);
      expect(bow.defenseBonus).toBe(0);
    });
  });
});
