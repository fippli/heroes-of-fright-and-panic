import type { BuildingType } from "@shared/building";
import type { PieceKind } from "@shared/piece";
import type { ResourceMap } from "@shared/player/resource-map";

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
  readonly resources: ResourceMap;
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
