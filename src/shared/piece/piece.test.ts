import { describe, it, expect } from "vitest";
import { Equipment, EquipmentType } from "@shared/equipment/index.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import { Steed } from "@shared/steed/index.ts";
import { Piece, PieceKind } from "./index.ts";

describe("Piece", () => {
  describe("peasant", () => {
    it("has base stats: 1 heart, 1 attack, 0 defense, 1 view, 1 move", () => {
      const peasant = Piece.peasant("day");
      expect(peasant.hearts).toBe(1);
      expect(peasant.attack).toBe(1);
      expect(peasant.defense).toBe(0);
      expect(peasant.view).toBe(1);
      expect(peasant.move).toBe(1);
      expect(peasant.attackRange).toBe(1);
    });

    it("can equip items", () => {
      const peasant = Piece.peasant("day");
      expect(peasant.canEquip).toBe(true);
    });

    it("can mount steeds", () => {
      const peasant = Piece.peasant("day");
      expect(peasant.canMountSteed).toBe(true);
    });

    it("walks on grass, sand, farm", () => {
      const peasant = Piece.peasant("day");
      expect(peasant.walkableLandscape).toContain(LandscapeType.grass);
      expect(peasant.walkableLandscape).toContain(LandscapeType.sand);
      expect(peasant.walkableLandscape).toContain(LandscapeType.farm);
      expect(peasant.walkableLandscape).not.toContain(LandscapeType.tree);
      expect(peasant.walkableLandscape).not.toContain(LandscapeType.water);
    });
  });

  describe("king", () => {
    it("has stats: 3 hearts, 1 attack, 1 defense, 2 view, 1 move", () => {
      const king = Piece.king("day");
      expect(king.hearts).toBe(3);
      expect(king.attack).toBe(1);
      expect(king.defense).toBe(1);
      expect(king.view).toBe(2);
      expect(king.move).toBe(1);
    });

    it("cannot equip items", () => {
      const king = Piece.king("day");
      expect(king.canEquip).toBe(false);
    });
  });

  describe("priest", () => {
    it("has stats: 3 hearts, 0 attack, 0 defense, 1 view, 1 move", () => {
      const priest = Piece.priest("night");
      expect(priest.hearts).toBe(3);
      expect(priest.attack).toBe(0);
      expect(priest.defense).toBe(0);
      expect(priest.view).toBe(1);
      expect(priest.move).toBe(1);
    });

    it("cannot equip items but can mount steeds", () => {
      const priest = Piece.priest("day");
      expect(priest.canEquip).toBe(false);
      expect(priest.canMountSteed).toBe(true);
    });
  });

  describe("arch angel", () => {
    it("has stats: 3 hearts, 3 attack, 3 defense, 3 view, 3 move", () => {
      const angel = Piece.archAngel("day");
      expect(angel.hearts).toBe(3);
      expect(angel.attack).toBe(3);
      expect(angel.defense).toBe(3);
      expect(angel.view).toBe(3);
      expect(angel.move).toBe(3);
    });

    it("cannot equip items or mount steeds", () => {
      const angel = Piece.archAngel("day");
      expect(angel.canEquip).toBe(false);
      expect(angel.canMountSteed).toBe(false);
    });
  });

  describe("equipment composition", () => {
    it("sword gives +1 attack", () => {
      const peasant = Piece.peasant("day");
      const swordsman = peasant.withEquipment(Equipment.sword());
      expect(swordsman.attack).toBe(2);
      expect(swordsman.defense).toBe(0);
    });

    it("shield gives +1 defense", () => {
      const peasant = Piece.peasant("day");
      const defender = peasant.withEquipment(Equipment.shield());
      expect(defender.attack).toBe(1);
      expect(defender.defense).toBe(1);
    });

    it("bow gives +1 attack range and enables tree walking", () => {
      const peasant = Piece.peasant("day");
      const archer = peasant.withEquipment(Equipment.bow());
      expect(archer.attackRange).toBe(2);
      expect(archer.walkableLandscape).toContain(LandscapeType.tree);
    });

    it("sword + shield = soldier (2 attack, 1 defense)", () => {
      const soldier = Piece.peasant("day")
        .withEquipment(Equipment.sword())
        .withEquipment(Equipment.shield());
      expect(soldier.attack).toBe(2);
      expect(soldier.defense).toBe(1);
    });

    it("cannot equip the same item twice", () => {
      const peasant = Piece.peasant("day").withEquipment(Equipment.sword());
      const same = peasant.withEquipment(Equipment.sword());
      expect(same.equipment).toHaveLength(1);
    });

    it("king cannot equip items (withEquipment returns same piece)", () => {
      const king = Piece.king("day");
      const result = king.withEquipment(Equipment.sword());
      expect(result.equipment).toHaveLength(0);
      expect(result.attack).toBe(1);
    });

    it("does not mutate original piece", () => {
      const peasant = Piece.peasant("day");
      const swordsman = peasant.withEquipment(Equipment.sword());
      expect(peasant.attack).toBe(1);
      expect(swordsman.attack).toBe(2);
    });
  });

  describe("steed composition", () => {
    it("horse gives +1 view and +1 move", () => {
      const peasant = Piece.peasant("day");
      const mounted = peasant.withSteed(Steed.horse());
      expect(mounted.view).toBe(2);
      expect(mounted.move).toBe(2);
    });

    it("boat gives +1 view, +1 move, enables water travel", () => {
      const peasant = Piece.peasant("day");
      const boated = peasant.withSteed(Steed.boat());
      expect(boated.view).toBe(2);
      expect(boated.move).toBe(2);
      expect(boated.walkableLandscape).toContain(LandscapeType.water);
    });

    it("horse gives +1 bow range to bow-equipped piece", () => {
      const mountedArcher = Piece.peasant("day")
        .withEquipment(Equipment.bow())
        .withSteed(Steed.horse());
      // base 1 + bow 1 + horse bow bonus 1 = 3
      expect(mountedArcher.attackRange).toBe(3);
    });

    it("horse does NOT give extra attack range without bow", () => {
      const mounted = Piece.peasant("day").withSteed(Steed.horse());
      expect(mounted.attackRange).toBe(1);
    });

    it("arch angel cannot mount steeds", () => {
      const angel = Piece.archAngel("day");
      const result = angel.withSteed(Steed.horse());
      expect(result.steed).toBeNull();
    });

    it("cannot mount twice", () => {
      const mounted = Piece.peasant("day").withSteed(Steed.horse());
      const result = mounted.withSteed(Steed.boat());
      expect(result.steed?.type).toBe("horse");
    });
  });

  describe("damage", () => {
    it("applies damage to defense first, then hearts", () => {
      const king = Piece.king("day"); // 3 hearts, 1 defense
      const damaged = king.withDamage(3); // 1 to defense, 2 to hearts
      expect(damaged.defense).toBe(0);
      expect(damaged.hearts).toBe(1);
    });

    it("destroys piece when hearts reach 0", () => {
      const peasant = Piece.peasant("day"); // 1 heart, 0 defense
      const dead = peasant.withDamage(1);
      expect(dead.hearts).toBe(0);
      expect(dead.isDead).toBe(true);
      expect(dead.isAlive).toBe(false);
    });

    it("does not go below 0 hearts", () => {
      const peasant = Piece.peasant("day");
      const overkill = peasant.withDamage(10);
      expect(overkill.hearts).toBe(0);
    });

    it("shield absorbs damage as defense", () => {
      const defender = Piece.peasant("day").withEquipment(Equipment.shield());
      // 1 heart, 1 defense. 1 damage: absorbed by defense
      const hit = defender.withDamage(1);
      expect(hit.defense).toBe(0);
      expect(hit.hearts).toBe(1);
      expect(hit.isAlive).toBe(true);
    });

    it("swordsman (attack 2) kills defender in one hit", () => {
      const defender = Piece.peasant("day").withEquipment(Equipment.shield());
      // defender: 1 heart, 1 defense = 2 total HP
      const damaged = defender.withDamage(2); // swordsman attack
      expect(damaged.hearts).toBe(0);
      expect(damaged.isDead).toBe(true);
    });
  });

  describe("healing", () => {
    it("heals hearts up to maxHearts", () => {
      const king = Piece.king("day"); // 3 max hearts
      const damaged = king.withDamage(2); // loses defense first then 1 heart => 2 hearts
      const healed = damaged.withHealing(1);
      expect(healed.hearts).toBe(3);
    });

    it("does not heal above maxHearts", () => {
      const peasant = Piece.peasant("day"); // 1 max heart
      const healed = peasant.withHealing(5);
      expect(healed.hearts).toBe(1);
    });

    it("does not restore defense (defense cannot be healed)", () => {
      const king = Piece.king("day"); // 1 defense
      const damaged = king.withDamage(1); // defense -> 0
      const healed = damaged.withHealing(1);
      expect(healed.defense).toBe(0); // defense stays at 0
    });
  });

  describe("costs", () => {
    it("peasant spawn costs 1 food", () => {
      const cost = Piece.spawnCost();
      expect(cost.food).toBe(1);
    });

    it("priest costs 1 gold", () => {
      const cost = Piece.priestCost();
      expect(cost.gold).toBe(1);
    });

    it("arch angel costs 100 faith", () => {
      const cost = Piece.archAngelCost();
      expect(cost.faith).toBe(100);
    });
  });

  describe("ownership", () => {
    it("isOwnedBy returns true for matching player", () => {
      const peasant = Piece.peasant("day");
      expect(peasant.isOwnedBy("day")).toBe(true);
      expect(peasant.isOwnedBy("night")).toBe(false);
    });
  });
});
