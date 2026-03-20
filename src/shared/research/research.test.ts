import { describe, it, expect } from "vitest";
import { Research, ResearchType, MAX_SPEED_LEVEL } from "./index.ts";

describe("Research", () => {
  it("starts with default values", () => {
    const research = new Research({});
    expect(research.speedLevel).toBe(0);
    expect(research.hasMiningII).toBe(false);
    expect(research.hasMiningIII).toBe(false);
    expect(research.hasQueen).toBe(false);
  });

  describe("speed research", () => {
    it("can research speed from level 0", () => {
      const research = new Research({});
      expect(research.canResearch(ResearchType.speed)).toBe(true);
    });

    it("increments speed level", () => {
      const research = new Research({});
      const upgraded = research.withResearch(ResearchType.speed);
      expect(upgraded.speedLevel).toBe(1);
    });

    it("cannot research speed beyond max level", () => {
      const maxed = new Research({ speedLevel: MAX_SPEED_LEVEL });
      expect(maxed.canResearch(ResearchType.speed)).toBe(false);
    });

    it("returns same instance when cannot research", () => {
      const maxed = new Research({ speedLevel: MAX_SPEED_LEVEL });
      const result = maxed.withResearch(ResearchType.speed);
      expect(result.speedLevel).toBe(MAX_SPEED_LEVEL);
    });

    it("costs 1 wood per level", () => {
      const cost = Research.costOf(ResearchType.speed);
      expect(cost.wood).toBe(1);
    });
  });

  describe("mining research", () => {
    it("can research Mining II without prerequisite", () => {
      const research = new Research({});
      expect(research.canResearch(ResearchType.miningII)).toBe(true);
    });

    it("cannot research Mining III without Mining II", () => {
      const research = new Research({});
      expect(research.canResearch(ResearchType.miningIII)).toBe(false);
    });

    it("can research Mining III after Mining II", () => {
      const research = new Research({ hasMiningII: true });
      expect(research.canResearch(ResearchType.miningIII)).toBe(true);
    });

    it("cannot research Mining II twice", () => {
      const research = new Research({ hasMiningII: true });
      expect(research.canResearch(ResearchType.miningII)).toBe(false);
    });

    it("Mining II costs 1 stone", () => {
      const cost = Research.costOf(ResearchType.miningII);
      expect(cost.stone).toBe(1);
    });

    it("Mining III costs 1 iron", () => {
      const cost = Research.costOf(ResearchType.miningIII);
      expect(cost.iron).toBe(1);
    });
  });

  describe("queen research", () => {
    it("can research queen", () => {
      const research = new Research({});
      expect(research.canResearch(ResearchType.queen)).toBe(true);
    });

    it("cannot research queen twice", () => {
      const research = new Research({ hasQueen: true });
      expect(research.canResearch(ResearchType.queen)).toBe(false);
    });

    it("queen costs 25 gold", () => {
      const cost = Research.costOf(ResearchType.queen);
      expect(cost.gold).toBe(25);
    });
  });

  describe("minutesPerAction", () => {
    it("level 0 = 60 minutes", () => {
      expect(new Research({}).minutesPerAction).toBe(60);
    });

    it("level 1 = 30 minutes", () => {
      expect(new Research({ speedLevel: 1 }).minutesPerAction).toBe(30);
    });

    it("level 5 = 1 minute", () => {
      expect(new Research({ speedLevel: 5 }).minutesPerAction).toBe(1);
    });
  });

  it("does not mutate original when researching", () => {
    const original = new Research({});
    const upgraded = original.withResearch(ResearchType.miningII);
    expect(original.hasMiningII).toBe(false);
    expect(upgraded.hasMiningII).toBe(true);
  });
});
