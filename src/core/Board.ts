import { Building, type BuildingType } from "./Building";
import { Hexagon } from "./Hexagon";
import { Log } from "./Log";
import type { Piece } from "./Piece";
import type { Player } from "./Player";
import { Tile, type TilePosition } from "./Tile";

const log = new Log();

export class Board {
  tiles: Tile[];
  player: Player;
  time: number = 0;

  // buildings: Building[] = [];

  // pieces: Piece[] = [];

  selectedTile: Tile | undefined | null = undefined;
  selectedPiece: Piece | undefined = undefined;
  selectedBuilding: Building | null = null;

  constructor({
    tiles,
    // buildings,
    // pieces,
    player,
  }: {
    tiles: Tile[];
    // buildings: Building[];
    // pieces: Piece[];
    player: Player;
  }) {
    this.tiles = tiles;
    // this.buildings = buildings;
    // this.pieces = pieces;
    this.player = player;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // console.time("renderTiles");

    this.tiles.forEach((tile: Tile) => {
      tile.render(ctx);
      tile.building?.render(ctx, { row: tile.row, col: tile.col });
      tile.piece?.render(ctx, { row: tile.row, col: tile.col });
    });

    // this.buildings.forEach((building: Building) => {
    //   building.render(ctx, { row: building.row, col: building.col });
    // });

    // console.timeEnd("renderTiles");

    // this.pieces.forEach((piece: Piece) => {
    //   piece.render(ctx);
    // });

    if (this.selectedTile) {
      Hexagon.render(
        ctx,
        Hexagon.x(this.selectedTile?.row, this.selectedTile?.col),
        Hexagon.y(this.selectedTile?.row),
        "#00ff00",
      );

      // this.selectedTile.building?.renderOutline(ctx, this.tiles);
    }

    ctx.restore();
  }

  calculateNextState() {
    // this.tiles.forEach((tile: Tile) => {
    //   if (tile.piece) {
    //     this.exploreTiles(this.tiles, tile);
    //   }
    //   if (tile.building) {
    //     this.exploreTiles(this.tiles, tile);
    //   }
    // });

    this.exploreTiles();
  }

  exploreTiles() {
    this.tiles.forEach((tile) => tile.explore(this.tiles));
  }

  action() {}

  findTile(pos: { x: number; y: number } | { row: number; col: number }) {
    if ("x" in pos && "y" in pos) {
      return this.tiles.find((tile) => {
        return tile.isMouseOver(pos.x, pos.y);
      });
    } else {
      return this.tiles.find((tile) => {
        return tile.row === pos.row && tile.col === pos.col;
      });
    }
  }

  click({ x, y }: { x: number; y: number }) {
    const clickedTile = this.findTile({ x, y });

    if (!clickedTile) {
      return;
    }

    log.add(clickedTile.landscape?.type ?? "Unexplored");
    console.log(this.selectedTile);

    if (this.selectedTile) {
      if (clickedTile.isNeighborTo(this.selectedTile)) {
        clickedTile.place(this.selectedTile?.piece);
        this.selectedTile.unplace();
      }
    }

    this.selectedTile = clickedTile;
    console.log(clickedTile);
    console.log(this.selectedTile?.piece);
    log.add(
      `Selected tile: ${this.selectedTile?.row}, ${this.selectedTile?.col}`,
      clickedTile.piece?.type,
      clickedTile.building?.type,
    );

    this.time = this.time + 1;
    if (this.time % 24 === 0) {
    }
  }

  build(buildingType: BuildingType, { x, y }: { x: number; y: number }) {
    const tile = this.findTile({ x, y });

    if (!tile) return;

    // if the tile has a neighbour with a piece
    const neighborWithPiece = tile.getNeighbors(this.tiles).some((tile) => {
      return tile.piece !== undefined;
    });

    if (neighborWithPiece) {
      const building = Building.build(buildingType);
      if (this.player.canAfford(building.cost)) {
        this.player.pay(building.cost);
        tile.build(building);
      } else {
        console.log("Cannot afford building");
      }
    }
  }
}
