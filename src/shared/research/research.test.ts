import { describe, it, expect } from "vitest";
import {
  ResearchType,
  createResearch,
  canResearch,
  applyResearch,
  researchCostOf,
} from "./index.ts";

describe("Research", () => {
  it("starts with default values", () => {
    const research = createResearch();
    expect(research.hasQueen).toBe(false);
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
      expect(researchCostOf(ResearchType.queen).gold).toBe(25);
    });
  });

  it("does not mutate original when researching", () => {
    const original = createResearch();
    const upgraded = applyResearch(original, ResearchType.queen);
    expect(original.hasQueen).toBe(false);
    expect(upgraded.hasQueen).toBe(true);
  });
});
