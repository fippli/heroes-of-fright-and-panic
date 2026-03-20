import { ResourceMap } from "@shared/player/resource-map.ts";

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

export class Research {
  readonly speedLevel: number;
  readonly hasMiningII: boolean;
  readonly hasMiningIII: boolean;
  readonly hasQueen: boolean;

  constructor({
    speedLevel = 0,
    hasMiningII = false,
    hasMiningIII = false,
    hasQueen = false,
  }: {
    speedLevel?: number;
    hasMiningII?: boolean;
    hasMiningIII?: boolean;
    hasQueen?: boolean;
  }) {
    this.speedLevel = speedLevel;
    this.hasMiningII = hasMiningII;
    this.hasMiningIII = hasMiningIII;
    this.hasQueen = hasQueen;
  }

  static costOf(researchType: ResearchType): ResourceMap {
    switch (researchType) {
      case ResearchType.speed:
        return new ResourceMap({ wood: 1 });
      case ResearchType.miningII:
        return new ResourceMap({ stone: 1 });
      case ResearchType.miningIII:
        return new ResourceMap({ iron: 1 });
      case ResearchType.queen:
        return new ResourceMap({ gold: 25 });
      default:
        return new ResourceMap({});
    }
  }

  canResearch(researchType: ResearchType): boolean {
    switch (researchType) {
      case ResearchType.speed:
        return this.speedLevel < MAX_SPEED_LEVEL;
      case ResearchType.miningII:
        return !this.hasMiningII;
      case ResearchType.miningIII:
        return this.hasMiningII && !this.hasMiningIII;
      case ResearchType.queen:
        return !this.hasQueen;
      default:
        return false;
    }
  }

  withResearch(researchType: ResearchType): Research {
    if (!this.canResearch(researchType)) {
      return this;
    }
    switch (researchType) {
      case ResearchType.speed:
        return new Research({
          ...this.toArgs(),
          speedLevel: this.speedLevel + 1,
        });
      case ResearchType.miningII:
        return new Research({
          ...this.toArgs(),
          hasMiningII: true,
        });
      case ResearchType.miningIII:
        return new Research({
          ...this.toArgs(),
          hasMiningIII: true,
        });
      case ResearchType.queen:
        return new Research({
          ...this.toArgs(),
          hasQueen: true,
        });
      default:
        return this;
    }
  }

  get minutesPerAction(): number {
    const level = SPEED_LEVELS.find(
      (entry) => entry.level === this.speedLevel,
    );
    return level !== undefined ? level.minutesPerAction : 60;
  }

  private toArgs() {
    return {
      speedLevel: this.speedLevel,
      hasMiningII: this.hasMiningII,
      hasMiningIII: this.hasMiningIII,
      hasQueen: this.hasQueen,
    };
  }
}
