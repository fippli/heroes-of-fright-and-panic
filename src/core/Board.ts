import { Building, type BuildingType } from "./Building";
import { Hexagon } from "./Hexagon";
import { LandscapeType } from "./Landscape";
import type { Piece } from "./Piece";
import type { Player } from "./Player";
import { Tile, type TilePosition } from "./Tile";

export class Board {
  tiles: Tile[];
  player: Player;
  time: number = 0;
  buildings: Building[] = [];
  pieces: Piece[] = [];
  selectedPiece: Piece | undefined = undefined;
  selectedBuilding: Building | null = null;

  constructor({
    tiles,
    buildings,
    pieces,
    player,
  }: {
    tiles: Tile[];
    buildings: Building[];
    pieces: Piece[];
    player: Player;
  }) {
    this.tiles = tiles;
    this.buildings = buildings;
    this.pieces = pieces;
    this.player = player;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // console.time("renderTiles");

    this.tiles.forEach((tile: Tile) => {
      tile.render(ctx);
    });

    this.buildings.forEach((building: Building) => {
      building.render(ctx);
    });

    // console.timeEnd("renderTiles");

    this.pieces.forEach((piece: Piece) => {
      piece.render(ctx);
    });

    if (this.selectedPiece) {
      Hexagon.render(
        ctx,
        Hexagon.x(this.selectedPiece.row, this.selectedPiece.col),
        Hexagon.y(this.selectedPiece.row),
        "#00ff00",
      );
    }

    if (this.selectedBuilding) {
      Hexagon.render(
        ctx,
        Hexagon.x(this.selectedBuilding.row, this.selectedBuilding.col),
        Hexagon.y(this.selectedBuilding.row),
        "#00ff00",
      );
    }
    ctx.restore();
  }

  calculateNextState() {
    this.pieces.forEach((piece: Piece) => {
      this.tiles = this.exploreTiles(this.tiles, piece);
    });

    this.buildings.forEach((building: Building) => {
      this.tiles = this.exploreTiles(this.tiles, building);
    });

    this.tiles = this.exploreTiles(this.tiles, this.pieces[0]);

    if (this.player.currentHealth <= 0) {
      alert("Game over");
      window.location.reload();
      return;
    }
  }

  exploreTiles(tiles: Tile[], tilePosition: TilePosition): Tile[] {
    return tiles.reduce((currTiles: Tile[], tile: Tile, index: number) => {
      if (tile.isNeighborTo(tilePosition)) {
        const exploredTile = tile.explore(tile.getNeighbors(currTiles));

        return [
          ...currTiles.slice(0, index),
          exploredTile,
          ...currTiles.slice(index + 1),
        ];
      }
      return currTiles;
    }, tiles);
  }

  action() {}

  click({ x, y }: { x: number; y: number }) {
    const tile = this.tiles.find((tile) => {
      return tile.isMouseOver(x, y);
    });

    if (!tile) return;

    if (this.selectedPiece) {
      if (tile.isNeighborTo(this.selectedPiece)) {
        this.selectedPiece.place(tile, this.player, this.buildings);
      } else {
        this.selectedPiece = undefined;
      }
    } else {
      const selectedPiece = this.pieces.find((piece: Piece) => {
        return tile.has(piece);
      });
      this.selectedPiece = selectedPiece;
      this.selectedBuilding = null;
    }

    if (this.selectedBuilding) {
      if (
        tile.isNeighborTo(this.selectedBuilding) &&
        (tile.landscape?.type === LandscapeType.grass ||
          tile.landscape?.type === LandscapeType.sand)
      ) {
        this.pieces.push(this.selectedBuilding.spawn(tile));
      } else {
        this.selectedBuilding = null;
      }
    } else {
      const selectedBuilding = this.buildings.find((building: Building) => {
        return tile.has(building);
      });

      console.log(selectedBuilding);

      if (selectedBuilding) {
        this.selectedBuilding = selectedBuilding;
        this.selectedPiece = undefined;
      }
    }

    // if (tile && tile.isNeighborTo(this.player)) {
    //   this.player.place(tile);
    // } else {
    //   console.log("Invalid tile");
    // }

    this.time = this.time + 1;
    if (this.time % 24 === 0) {
      const foodConsumption = this.pieces.reduce((acc, piece) => {
        return acc + piece.foodConsumption;
      }, 0);

      const foodProduction = this.buildings.reduce((acc, building) => {
        return acc + building.foodProduction;
      }, 0);

      this.player.maxFood = foodProduction;

      this.player.currentFood =
        this.player.currentFood - foodConsumption + foodProduction;

      if (this.player.currentFood <= 0) {
        this.player.currentHealth = this.player.currentHealth - 1;
      }
    }
  }

  build(buildingType: BuildingType, { x, y }: { x: number; y: number }) {
    const tile = this.tiles.find((tile) => {
      return tile.isMouseOver(x, y);
    });

    if (!tile) return;

    // if the tile has a neighbour with a piece
    const neighborWithPiece = this.pieces.some((piece) => {
      return tile.isNeighborTo(piece);
    });

    if (neighborWithPiece) {
      const building = Building.build(buildingType, {
        row: tile.row,
        col: tile.col,
      });
      if (this.player.canAfford(building.cost)) {
        this.player.pay(building.cost);
        this.buildings.push(building);
      } else {
        console.log("Cannot afford building");
      }
    }
  }
}
