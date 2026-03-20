import type { Piece } from "@shared/piece/index.ts";
import type { Landscape } from "./landscape.ts";
import type { Building } from "@shared/building/index.ts";
import type { Steed } from "@shared/steed/index.ts";

export type Tile = {
  readonly column: number;
  readonly row: number;
  readonly landscape: Landscape | null;
  readonly piece: Piece | null;
  readonly building: Building | null;
  readonly steed?: Steed | null;
};

export type TilePosition = {
  readonly column: number;
  readonly row: number;
};
