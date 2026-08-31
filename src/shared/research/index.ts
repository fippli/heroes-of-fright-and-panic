import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum ResearchType {
  queen = "queen",
}

export type Research = {
  readonly hasQueen: boolean;
};

export const createResearch = ({
  hasQueen = false,
}: {
  hasQueen?: boolean;
} = {}): Research => ({
  hasQueen,
});

export const researchCostOf = (researchType: ResearchType): ResourceMap => {
  switch (researchType) {
    case ResearchType.queen:
      return createResourceMap({ gold: 25 });
    default:
      return createResourceMap();
  }
};

export const canResearch = (
  research: Research,
  researchType: ResearchType,
): boolean => {
  switch (researchType) {
    case ResearchType.queen:
      return !research.hasQueen;
    default:
      return false;
  }
};

export const applyResearch = (
  research: Research,
  researchType: ResearchType,
): Research => {
  if (!canResearch(research, researchType)) {
    return research;
  }
  switch (researchType) {
    case ResearchType.queen:
      return { ...research, hasQueen: true };
    default:
      return research;
  }
};
