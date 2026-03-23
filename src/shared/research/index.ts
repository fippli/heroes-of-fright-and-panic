import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum ResearchType {
  speed = "speed",
  miningII = "miningII",
  miningIII = "miningIII",
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
  readonly hasMiningII: boolean;
  readonly hasMiningIII: boolean;
  readonly hasQueen: boolean;
};

export const createResearch = ({
  speedLevel = 0,
  hasMiningII = false,
  hasMiningIII = false,
  hasQueen = false,
}: {
  speedLevel?: number;
  hasMiningII?: boolean;
  hasMiningIII?: boolean;
  hasQueen?: boolean;
} = {}): Research => ({
  speedLevel,
  hasMiningII,
  hasMiningIII,
  hasQueen,
});

export const researchCostOf = (researchType: ResearchType): ResourceMap => {
  switch (researchType) {
    case ResearchType.speed:
      return createResourceMap({ wood: 1 });
    case ResearchType.miningII:
      return createResourceMap({ stone: 1 });
    case ResearchType.miningIII:
      return createResourceMap({ iron: 1 });
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
    case ResearchType.miningII:
      return !research.hasMiningII;
    case ResearchType.miningIII:
      return research.hasMiningII && !research.hasMiningIII;
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
    case ResearchType.miningII:
      return { ...research, hasMiningII: true };
    case ResearchType.miningIII:
      return { ...research, hasMiningIII: true };
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
