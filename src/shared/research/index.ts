import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum ResearchType {
  speed = "speed",
  queen = "queen",
}

export const SPEED_LEVELS: ReadonlyArray<{
  readonly level: number;
  readonly minutesPerAction: number;
}> = [
  { level: 0, minutesPerAction: 60 },
  { level: 1, minutesPerAction: 30 },
  { level: 2, minutesPerAction: 15 },
  { level: 3, minutesPerAction: 10 },
  { level: 4, minutesPerAction: 5 },
  { level: 5, minutesPerAction: 1 },
];

export const MAX_SPEED_LEVEL = 5;

export type Research = {
  readonly speedLevel: number;
  readonly hasQueen: boolean;
};

export const createResearch = ({
  speedLevel = 0,
  hasQueen = false,
}: {
  speedLevel?: number;
  hasQueen?: boolean;
} = {}): Research => ({
  speedLevel,
  hasQueen,
});

export const researchCostOf = (researchType: ResearchType): ResourceMap => {
  switch (researchType) {
    case ResearchType.speed:
      return createResourceMap({ wood: 1 });
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
    case ResearchType.speed:
      return research.speedLevel < MAX_SPEED_LEVEL;
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
    case ResearchType.speed:
      return { ...research, speedLevel: research.speedLevel + 1 };
    case ResearchType.queen:
      return { ...research, hasQueen: true };
    default:
      return research;
  }
};

export const getMinutesPerAction = (research: Research): number => {
  const level = SPEED_LEVELS.find(
    (entry) => entry.level === research.speedLevel,
  );
  return level !== undefined ? level.minutesPerAction : 60;
};
