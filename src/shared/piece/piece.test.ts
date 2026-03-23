import { describe, it, expect } from "vitest";
import { createSword, createShield, createBow, EquipmentType } from "@shared/equipment/index.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import { createHorse, createBoat } from "@shared/steed/index.ts";
import {
  type Piece,
  PieceKind,
  createPeasant,
  createKing,
  createPriest,
  createArchAngel,
  getPieceAttack,
  getPieceDefense,
  getPieceView,
  getPieceMove,
  getPieceAttackRange,
  getWalkableLandscape,
  isPieceAlive,
  isPieceDead,
  pieceWithEquipment,
  pieceWithSteed,
  pieceWithDamage,
  pieceWithHealing,
  peasantSpawnCost,
  priestTrainCost,
  archAngelSummonCost,
} from "./index.ts";

describe("Piece", () => {
  describe("peasant", () => {
    it("has base stats: 1 heart, 1 attack, 0 defense, 1 view, 1 move", () => {
      const peasant = createPeasant("day");
      expect(peasant.hearts).toBe(1);
      expect(getPieceAttack(peasant)).toBe(1);
      expect(getPieceDefense(peasant)).toBe(0);
      expect(getPieceView(peasant)).toBe(1);
      expect(getPieceMove(peasant)).toBe(1);
      expect(getPieceAttackRange(peasant)).toBe(1);
    });

    it("can equip items", () => {
      const peasant = createPeasant("day");
      expect(peasant.canEquip).toBe(true);
    });

    it("can mount steeds", () => {
      const peasant = createPeasant("day");
      expect(peasant.canMountSteed).toBe(true);
    });

    it("walks on grass, sand, farm", () => {
      const peasant = createPeasant("day");
      expect(getWalkableLandscape(peasant)).toContain(LandscapeType.grass);
      expect(getWalkableLandscape(peasant)).toContain(LandscapeType.sand);
      expect(getWalkableLandscape(peasant)).toContain(LandscapeType.farm);
      expect(getWalkableLandscape(peasant)).not.toContain(LandscapeType.tree);
      expect(getWalkableLandscape(peasant)).not.toContain(LandscapeType.water);
    });
  });

  describe("king", () => {
    it("has stats: 3 hearts, 1 attack, 1 defense, 2 view, 1 move", () => {
      const king = createKing("day");
      expect(king.hearts).toBe(3);
      expect(getPieceAttack(king)).toBe(1);
      expect(getPieceDefense(king)).toBe(1);
      expect(getPieceView(king)).toBe(2);
      expect(getPieceMove(king)).toBe(1);
    });

    it("cannot equip items", () => {
      const king = createKing("day");
      expect(king.canEquip).toBe(false);
    });
  });

  describe("priest", () => {
    it("has stats: 3 hearts, 0 attack, 0 defense, 1 view, 1 move", () => {
      const priest = createPriest("night");
      expect(priest.hearts).toBe(3);
      expect(getPieceAttack(priest)).toBe(0);
      expect(getPieceDefense(priest)).toBe(0);
      expect(getPieceView(priest)).toBe(1);
      expect(getPieceMove(priest)).toBe(1);
    });

    it("cannot equip items but can mount steeds", () => {
      const priest = createPriest("day");
      expect(priest.canEquip).toBe(false);
      expect(priest.canMountSteed).toBe(true);
    });
  });

  describe("arch angel", () => {
    it("has stats: 3 hearts, 3 attack, 3 defense, 3 view, 3 move", () => {
      const angel = createArchAngel("day");
      expect(angel.hearts).toBe(3);
      expect(getPieceAttack(angel)).toBe(3);
      expect(getPieceDefense(angel)).toBe(3);
      expect(getPieceView(angel)).toBe(3);
      expect(getPieceMove(angel)).toBe(3);
    });

    it("cannot equip items or mount steeds", () => {
      const angel = createArchAngel("day");
      expect(angel.canEquip).toBe(false);
      expect(angel.canMountSteed).toBe(false);
    });
  });

  describe("equipment composition", () => {
    it("sword gives +1 attack", () => {
      const peasant = createPeasant("day");
      const swordsman = pieceWithEquipment(peasant, createSword());
      expect(getPieceAttack(swordsman)).toBe(2);
      expect(getPieceDefense(swordsman)).toBe(0);
    });

    it("shield gives +1 defense", () => {
      const peasant = createPeasant("day");
      const defender = pieceWithEquipment(peasant, createShield());
      expect(getPieceAttack(defender)).toBe(1);
      expect(getPieceDefense(defender)).toBe(1);
    });

    it("bow gives +1 attack range and enables tree walking", () => {
      const peasant = createPeasant("day");
      const archer = pieceWithEquipment(peasant, createBow());
      expect(getPieceAttackRange(archer)).toBe(2);
      expect(getWalkableLandscape(archer)).toContain(LandscapeType.tree);
    });

    it("sword + shield = soldier (2 attack, 1 defense)", () => {
      const soldier = pieceWithEquipment(
        pieceWithEquipment(createPeasant("day"), createSword()),
        createShield(),
      );
      expect(getPieceAttack(soldier)).toBe(2);
      expect(getPieceDefense(soldier)).toBe(1);
    });

    it("cannot equip the same item twice", () => {
      const peasant = pieceWithEquipment(createPeasant("day"), createSword());
      const same = pieceWithEquipment(peasant, createSword());
      expect(same.equipment).toHaveLength(1);
    });

    it("king cannot equip items (pieceWithEquipment returns same piece)", () => {
      const king = createKing("day");
      const result = pieceWithEquipment(king, createSword());
      expect(result.equipment).toHaveLength(0);
      expect(getPieceAttack(result)).toBe(1);
    });

    it("does not mutate original piece", () => {
      const peasant = createPeasant("day");
      const swordsman = pieceWithEquipment(peasant, createSword());
      expect(getPieceAttack(peasant)).toBe(1);
      expect(getPieceAttack(swordsman)).toBe(2);
    });
  });

  describe("steed composition", () => {
    it("horse gives +1 view and +1 move", () => {
      const peasant = createPeasant("day");
      const mounted = pieceWithSteed(peasant, createHorse());
      expect(getPieceView(mounted)).toBe(2);
      expect(getPieceMove(mounted)).toBe(2);
    });

    it("boat gives +1 view, +1 move, enables water travel", () => {
      const peasant = createPeasant("day");
      const boated = pieceWithSteed(peasant, createBoat());
      expect(getPieceView(boated)).toBe(2);
      expect(getPieceMove(boated)).toBe(2);
      expect(getWalkableLandscape(boated)).toContain(LandscapeType.water);
    });

    it("horse gives +1 bow range to bow-equipped piece", () => {
      const mountedArcher = pieceWithSteed(
        pieceWithEquipment(createPeasant("day"), createBow()),
        createHorse(),
      );
      // base 1 + bow 1 + horse bow bonus 1 = 3
      expect(getPieceAttackRange(mountedArcher)).toBe(3);
    });

    it("horse does NOT give extra attack range without bow", () => {
      const mounted = pieceWithSteed(createPeasant("day"), createHorse());
      expect(getPieceAttackRange(mounted)).toBe(1);
    });

    it("arch angel cannot mount steeds", () => {
      const angel = createArchAngel("day");
      const result = pieceWithSteed(angel, createHorse());
      expect(result.steed).toBeNull();
    });

    it("cannot mount twice", () => {
      const mounted = pieceWithSteed(createPeasant("day"), createHorse());
      const result = pieceWithSteed(mounted, createBoat());
      expect(result.steed?.type).toBe("horse");
    });
  });

  describe("damage", () => {
    it("applies damage to defense first, then hearts", () => {
      const king = createKing("day"); // 3 hearts, 1 defense
      const damaged = pieceWithDamage(king, 3); // 1 to defense, 2 to hearts
      expect(getPieceDefense(damaged)).toBe(0);
      expect(damaged.hearts).toBe(1);
    });

    it("destroys piece when hearts reach 0", () => {
      const peasant = createPeasant("day"); // 1 heart, 0 defense
      const dead = pieceWithDamage(peasant, 1);
      expect(dead.hearts).toBe(0);
      expect(isPieceDead(dead)).toBe(true);
      expect(isPieceAlive(dead)).toBe(false);
    });

    it("does not go below 0 hearts", () => {
      const peasant = createPeasant("day");
      const overkill = pieceWithDamage(peasant, 10);
      expect(overkill.hearts).toBe(0);
    });

    it("shield absorbs damage as defense", () => {
      const defender = pieceWithEquipment(createPeasant("day"), createShield());
      // 1 heart, 1 defense. 1 damage: absorbed by defense
      const hit = pieceWithDamage(defender, 1);
      expect(getPieceDefense(hit)).toBe(0);
      expect(hit.hearts).toBe(1);
      expect(isPieceAlive(hit)).toBe(true);
    });

    it("swordsman (attack 2) kills defender in one hit", () => {
      const defender = pieceWithEquipment(createPeasant("day"), createShield());
      // defender: 1 heart, 1 defense = 2 total HP
      const damaged = pieceWithDamage(defender, 2); // swordsman attack
      expect(damaged.hearts).toBe(0);
      expect(isPieceDead(damaged)).toBe(true);
    });
  });

  describe("healing", () => {
    it("heals hearts up to maxHearts", () => {
      const king = createKing("day"); // 3 max hearts
      const damaged = pieceWithDamage(king, 2); // loses defense first then 1 heart => 2 hearts
      const healed = pieceWithHealing(damaged, 1);
      expect(healed.hearts).toBe(3);
    });

    it("does not heal above maxHearts", () => {
      const peasant = createPeasant("day"); // 1 max heart
      const healed = pieceWithHealing(peasant, 5);
      expect(healed.hearts).toBe(1);
    });

    it("does not restore defense (defense cannot be healed)", () => {
      const king = createKing("day"); // 1 defense
      const damaged = pieceWithDamage(king, 1); // defense -> 0
      const healed = pieceWithHealing(damaged, 1);
      expect(getPieceDefense(healed)).toBe(0); // defense stays at 0
    });
  });

  describe("costs", () => {
    it("peasant spawn costs 1 food", () => {
      const cost = peasantSpawnCost();
      expect(cost.food).toBe(1);
    });

    it("priest costs 1 gold", () => {
      const cost = priestTrainCost();
      expect(cost.gold).toBe(1);
    });

    it("arch angel costs 100 faith", () => {
      const cost = archAngelSummonCost();
      expect(cost.faith).toBe(100);
    });
  });

  describe("ownership", () => {
    it("owner matches the creating player", () => {
      const peasant = createPeasant("day");
      expect(peasant.owner === "day").toBe(true);
      expect(peasant.owner === "night").toBe(false);
    });
  });
});
