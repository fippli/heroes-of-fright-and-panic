import type { BuildingType } from "@shared/building";
import type { PieceKind } from "@shared/piece";
import type { ResourceMap } from "@shared/player/resource-map";
import type { Research } from "@shared/research";

export type Notice = {
  readonly id: number;
  readonly text: string;
  readonly tone: "info" | "success" | "error";
};

/** What the sidebar needs to know about the board, published on every change */
export type GameUiState = {
  /** Latest thing worth telling the player; null when there is nothing new */
  readonly notice: Notice | null;
  readonly isPlayer: boolean;
  readonly isMyTurn: boolean;
  readonly currentPlayer: string;
  readonly resources: ResourceMap;
  /** What the next dawn/dusk will bring, given the current board */
  readonly production: ResourceMap;
  readonly research: Research;
  readonly clock: {
    readonly time: number;
    readonly isDay: boolean;
    /** Hours until the phase changes */
    readonly hoursLeft: number;
    /** 0–1 through the current phase */
    readonly progress: number;
  };
  readonly pendingBuild: BuildingType | null;
  /** A target-picking mode waiting for a tile click */
  readonly pendingTarget: TargetMode | null;
  readonly selected: {
    readonly row: number;
    readonly column: number;
    readonly landscape: string | null;
    /** Own building on the selected tile, if any */
    readonly building: BuildingType | null;
    /** Own piece on the selected tile, if any */
    readonly piece: PieceKind | null;
    /** Whatever piece is on the tile (own or enemy), for the inspector */
    readonly pieceInfo: PieceInfo | null;
    readonly buildingInfo: BuildingInfo | null;
  } | null;
};

export type TargetMode = "heal" | "enterTower" | "horse" | "boat";

export type PieceInfo = {
  readonly kind: PieceKind;
  readonly owner: string;
  readonly hearts: number;
  readonly maxHearts: number;
  readonly attack: number;
  readonly defense: number;
  readonly attackRange: number;
  readonly viewRange: number;
  readonly move: number;
  readonly equipment: readonly string[];
  readonly steed: string | null;
};

export type BuildingInfo = {
  readonly type: BuildingType;
  readonly owner: string;
  readonly viewRange: number;
};

export type ResourceEntry = { readonly resource: string; readonly amount: number };

/** Non-zero entries of a cost, in display order */
export const costEntries = (cost: ResourceMap): readonly ResourceEntry[] =>
  (["wood", "stone", "food", "gold", "iron", "faith"] as const)
    .map((resource) => ({ resource, amount: cost[resource] ?? 0 }))
    .filter((entry) => entry.amount > 0);

/** 6.5 → "06:30" */
export const formatClock = (time: number): string => {
  const wrapped = ((time % 24) + 24) % 24;
  const hours = Math.floor(wrapped);
  const minutes = Math.round((wrapped - hours) * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

/** Phase timing for a clock time: day is 06:00–18:00, night wraps midnight */
export const phaseOf = (time: number): { isDay: boolean; hoursLeft: number; progress: number } => {
  const wrapped = ((time % 24) + 24) % 24;
  const isDay = wrapped >= 6 && wrapped < 18;
  const elapsed = isDay ? wrapped - 6 : wrapped >= 18 ? wrapped - 18 : wrapped + 6;
  return { isDay, hoursLeft: 12 - elapsed, progress: elapsed / 12 };
};
