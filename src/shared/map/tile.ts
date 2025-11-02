import { Piece } from "@shared/piece";
import { Landscape } from "./landscape";
import { Building } from "@shared/building";

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
