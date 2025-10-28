import { Landscape } from "./landscape";

export type Tile = {
  column: number;
  row: number;
  landscape: Landscape | null;
};
