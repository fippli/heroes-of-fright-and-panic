import { compose } from "../utils/compose";
import { Building, BuildingType } from "./Building";
import { Clock } from "./Clock";
import { Landscape } from "./Landscape";
import { Log } from "./Log";
import { Piece, PieceType } from "./Piece";

import { Player } from "./Player";
import { Tile } from "./Tile";

const log = new Log();

export class Board {
  tiles: Tile[];
  clock: Clock = new Clock();
  player: Player;

  dayPlayer: Player | undefined | null = undefined;
  nightPlayer: Player | undefined | null = undefined;

  selectedTile: Tile | undefined | null = undefined;

  constructor({ tiles, player }: { tiles: Tile[]; player: Player }) {
    this.tiles = tiles;
    this.player = player;

    this.dayPlayer = new Player({ row: player.row, col: player.col });
    this.nightPlayer = new Player({ row: player.row, col: player.col });

    this.generateMap();
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // console.time("renderTiles");

    this.tiles.forEach((tile: Tile) => {
      tile.render(ctx);
    });

    if (this.selectedTile) {
      this.selectedTile.renderArea(ctx, this.tiles);
    }

    ctx.restore();

    this.player.resources.render();
  }

  generateMap() {
    const startTiles = this.tiles;
    this.tiles = startTiles.reduce((acc, tile) => {
      const newTile = tile.giveLandscape(
        Landscape.generate(tile.getNeighbors(acc)),
      );
      return acc.map((tile) =>
        tile.row === newTile.row && tile.col === newTile.col ? newTile : tile,
      );
    }, startTiles);

    // cleanup map

    this.tiles = compose(
      Landscape.cleanupSingles,
      Landscape.createBeaches,
      Landscape.cleanupSand,
      Landscape.placeTrees,
      Landscape.placeMountains,
    )(this.tiles);
  }

  replaceTile(tile: Tile) {
    return this.tiles.map((t) =>
      t.row === tile.row && t.col === tile.col ? tile : t,
    );
  }

  exploreTiles() {
    this.tiles.forEach((tile) => tile.explore(this.tiles));
  }

  unExploredTiles() {
    this.tiles.filter((tile) => tile.unexplore());
  }

  calculateNextState() {
    this.unExploredTiles();
    this.exploreTiles();
    if (this.clock.isNight()) {
      this.player = this.nightPlayer;
    } else {
      this.player = this.dayPlayer;
    }
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

    if (clickedTile == null) {
      return;
    }

    if (clickedTile.piece) {
      this.selectedTile = clickedTile;
      return;
    }

    if (this.selectedTile == null) {
      if (clickedTile.building || clickedTile.piece) {
        this.selectedTile = clickedTile;
        return;
      }
    }

    if (this.selectedTile?.piece) {
      if (clickedTile.isNeighborTo(this.selectedTile)) {
        if (
          clickedTile.landscape?.lootDrop &&
          this.selectedTile.piece.type === PieceType.peasant
        ) {
          const { lootDrop, nextLandscape } = clickedTile.landscape.loot();
          this.player.collect(lootDrop);
          clickedTile.landscape = nextLandscape;
          this.clock.tick();
          return;
        }

        if (clickedTile.walkable()) {
          clickedTile.place(this.selectedTile.piece);
          this.selectedTile.unplace();
          this.selectedTile = clickedTile;
          this.clock.tick();
          return;
        }
      }
    }

    if (this.selectedTile?.building) {
      this.selectedTile = clickedTile;
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

  placePiece(piece: Piece, { x, y }: { x: number; y: number }) {
    const tile = this.findTile({ x, y });
    if (!tile) return;

    if (tile.building?.type === BuildingType.house) {
      tile.place(piece);
      return;
    }
  }

  upgrade({ x, y }: { x: number; y: number }) {
    const tile = this.findTile({ x, y });

    if (!tile) return;

    if (tile.piece) {
      tile.piece = tile.piece.upgrade();
      return;
    }
  }

  upgradeArcher({ x, y }: { x: number; y: number }) {
    const tile = this.findTile({ x, y });
    if (!tile) return;

    if (tile.piece) {
      tile.piece = Piece.archer();
      return;
    }
  }
}
