import { describe, it, expect } from "vitest";
import {
  createResearch,
  canResearch,
  applyResearch,
  researchCostOf,
  getMinutesPerAction,
  ResearchType,
  MAX_SPEED_LEVEL,
} from "./index.ts";

describe("Research", () => {
  it("starts with default values", () => {
    const research = createResearch();
    expect(research.speedLevel).toBe(0);
    expect(research.hasMiningII).toBe(false);
    expect(research.hasMiningIII).toBe(false);
    expect(research.hasQueen).toBe(false);
  });

  describe("speed research", () => {
    it("can research speed from level 0", () => {
      const research = createResearch();
      expect(canResearch(research, ResearchType.speed)).toBe(true);
    });

    it("increments speed level", () => {
      const research = createResearch();
      const upgraded = applyResearch(research, ResearchType.speed);
      expect(upgraded.speedLevel).toBe(1);
    });

    it("cannot research speed beyond max level", () => {
      const maxed = createResearch({ speedLevel: MAX_SPEED_LEVEL });
      expect(canResearch(maxed, ResearchType.speed)).toBe(false);
    });

    it("returns same values when cannot research", () => {
      const maxed = createResearch({ speedLevel: MAX_SPEED_LEVEL });
      const result = applyResearch(maxed, ResearchType.speed);
      expect(result.speedLevel).toBe(MAX_SPEED_LEVEL);
    });

    it("costs 1 wood per level", () => {
      const cost = researchCostOf(ResearchType.speed);
      expect(cost.wood).toBe(1);
    });
  });

  describe("mining research", () => {
    it("can research Mining II without prerequisite", () => {
      const research = createResearch();
      expect(canResearch(research, ResearchType.miningII)).toBe(true);
    });

    it("cannot research Mining III without Mining II", () => {
      const research = createResearch();
      expect(canResearch(research, ResearchType.miningIII)).toBe(false);
    });

    it("can research Mining III after Mining II", () => {
      const research = createResearch({ hasMiningII: true });
      expect(canResearch(research, ResearchType.miningIII)).toBe(true);
    });

    it("cannot research Mining II twice", () => {
      const research = createResearch({ hasMiningII: true });
      expect(canResearch(research, ResearchType.miningII)).toBe(false);
    });

    it("Mining II costs 1 stone", () => {
      const cost = researchCostOf(ResearchType.miningII);
      expect(cost.stone).toBe(1);
    });

    it("Mining III costs 1 iron", () => {
      const cost = researchCostOf(ResearchType.miningIII);
      expect(cost.iron).toBe(1);
    });
  });

  describe("queen research", () => {
    it("can research queen", () => {
      const research = createResearch();
      expect(canResearch(research, ResearchType.queen)).toBe(true);
    });

    it("cannot research queen twice", () => {
      const research = createResearch({ hasQueen: true });
      expect(canResearch(research, ResearchType.queen)).toBe(false);
    });

    it("queen costs 25 gold", () => {
      const cost = researchCostOf(ResearchType.queen);
      expect(cost.gold).toBe(25);
    });
  });

  describe("minutesPerAction", () => {
    it("level 0 = 60 minutes", () => {
      expect(getMinutesPerAction(createResearch())).toBe(60);
    });

    it("level 1 = 30 minutes", () => {
      expect(getMinutesPerAction(createResearch({ speedLevel: 1 }))).toBe(30);
    });

    it("level 5 = 1 minute", () => {
      expect(getMinutesPerAction(createResearch({ speedLevel: 5 }))).toBe(1);
    });
  });

  it("does not mutate original when researching", () => {
    const original = createResearch();
    const upgraded = applyResearch(original, ResearchType.miningII);
    expect(original.hasMiningII).toBe(false);
    expect(upgraded.hasMiningII).toBe(true);
  });
});
