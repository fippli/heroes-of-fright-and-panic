import type { Piece, PlayerType } from "@shared/piece/index.ts";
import type { Landscape, LandscapeType } from "./landscape.ts";
import type { Building, BuildingType } from "@shared/building/index.ts";
import type { Steed, SteedType } from "@shared/steed/index.ts";

/**
 * A river overlay crossing the tile between two of its edges (direction
 * indices from hex.ts: 0 = E … 5 = NE). The tile keeps its landscape — the
 * river flows over grass or sand like a tree stands on its ground.
 */
export type RiverSegment = {
  readonly entry: number;
  readonly exit: number;
};

export type Tile = {
  readonly column: number;
  readonly row: number;
  readonly landscape: Landscape | null;
  readonly piece: Piece | null;
  readonly building: Building | null;
  readonly steed?: Steed | null;
  readonly river?: RiverSegment | null;
};

/**
 * What a player last saw on a tile that has since left their vision: the
 * terrain and any building or waiting steed, but never pieces. Stale by
 * design — the world may have changed since.
 */
export type RememberedTile = {
  readonly landscape: LandscapeType | null;
  readonly building: {
    readonly type: BuildingType;
    readonly owner: PlayerType;
    readonly level: number;
    readonly connections?: ReadonlyArray<number> | null;
  } | null;
  readonly steed: SteedType | null;
  readonly river?: RiverSegment | null;
};

export type TilePosition = {
  readonly column: number;
  readonly row: number;
};
