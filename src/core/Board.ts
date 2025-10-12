import { Building } from "./Building";
import { EmptyRender } from "./EmptyRender";
import { Landscape } from "./Landscape";
import { Piece } from "./Piece";
import { Player } from "./Player";
import { Tile } from "./Tile";

export class Board {
  readonly tiles: Tile[];
  readonly landscapes: Landscape[];
  readonly buildings: Building[];
  readonly pieces: Piece[];
  readonly player: Player;

  constructor({
    tiles,
    landscapes,
    buildings,
    pieces,
    player,
  }: {
    tiles: Tile[];
    landscapes: Landscape[];
    buildings: Building[];
    pieces: Piece[];
    player: Player;
  }) {
    this.tiles = tiles;
    this.landscapes = landscapes;
    this.buildings = buildings;
    this.pieces = pieces;
    this.player = player;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    this.tiles.forEach((tile: Tile) => {
      const landscape = this.landscapes.find(tile.has) ?? new EmptyRender();
      const building = this.buildings.find(tile.has) ?? new EmptyRender();
      const piece = this.pieces.find(tile.has) ?? new EmptyRender();

      tile.render(ctx, {
        landscape,
        building,
        piece,
      });
    });

    ctx.restore();
  }

  // action
  action() {
    // do nothing but later
    // return new Board({...this, change})
  }
}
