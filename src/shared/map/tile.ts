import { Piece } from "@shared/piece/index.ts";
import { Landscape } from "./landscape.ts";
import { Building } from "@shared/building/index.ts";

export type Tile = {
  column: number;
  row: number;
  landscape: Landscape | null;
  piece: Piece | null;
  building: Building | null;
};

export type TilePosition = {
  column: number;
  row: number;
};
