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
  readonly selected: {
    readonly row: number;
    readonly column: number;
    /** Own building on the selected tile, if any */
    readonly building: BuildingType | null;
    /** Own piece on the selected tile, if any */
    readonly piece: PieceKind | null;
  } | null;
};

export type ResourceEntry = { readonly resource: string; readonly amount: number };

/** Non-zero entries of a cost, in display order */
export const costEntries = (cost: ResourceMap): readonly ResourceEntry[] =>
  (["wood", "stone", "food", "gold", "iron", "faith"] as const)
    .map((resource) => ({ resource, amount: cost[resource] ?? 0 }))
    .filter((entry) => entry.amount > 0);
