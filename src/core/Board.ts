import type { Canvas } from "../canvas";
import type { Coordinate } from "../types/coordinate";
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

  dayPlayer: Player;
  nightPlayer: Player;

  selectedTile: Tile | undefined | null = undefined;

  constructor(size: number) {
    this.tiles = this.generateMap(size);

    this.dayPlayer = new Player({ type: "day" });
    this.nightPlayer = new Player({ type: "night" });

    this.player = this.dayPlayer;

    const dayPlayerStartTile = this.findTile({
      row: Math.floor(size / 6),
      col: Math.floor(size / 6),
    });
    const nightPlayerStartTile = this.findTile({
      row: size - Math.floor(size / 6),
      col: size - Math.floor(size / 6),
    });

    if (dayPlayerStartTile) {
      dayPlayerStartTile.place(Piece.peasant(this.dayPlayer));
    }
    if (nightPlayerStartTile) {
      nightPlayerStartTile.place(Piece.peasant(this.nightPlayer));
    }
  }

  render(canvas: Canvas) {
    canvas.ctx.save();

    this.tiles.forEach((tile: Tile) => {
      tile.render(canvas.ctx);
    });

    if (this.selectedTile) {
      this.selectedTile.renderArea(canvas.ctx, this.tiles);
    }

    const hoveredTile = this.findTile(canvas.mousePosition);

    if (hoveredTile) {
      hoveredTile.renderHovered(canvas.ctx);
    }

    canvas.ctx.restore();

    this.player.resources.render();
    this.clock.render();
  }

  generateMap(size: number) {
    const startTiles = Array.from({ length: size * size }, (_, tileNumber) => {
      const col = tileNumber % size;
      const row = Math.floor(tileNumber / size);

      return new Tile({
        col,
        row,
        landscape: null,
      });
    }) as Tile[];

    const mapTiles = startTiles.reduce((acc, tile) => {
      const newTile = tile.giveLandscape(
        Landscape.generate(tile.getNeighbors(acc)),
      );
      return acc.map((tile) =>
        tile.row === newTile.row && tile.col === newTile.col ? newTile : tile,
      );
    }, startTiles);

    // cleanup map

    return compose(
      Landscape.cleanupSingles,
      Landscape.createBeaches,
      Landscape.cleanupSand,
      Landscape.placeTrees,
      Landscape.placeMountains,
    )(mapTiles);
  }

  replaceTile(tile: Tile) {
    return this.tiles.map((t) =>
      t.row === tile.row && t.col === tile.col ? tile : t,
    );
  }

  exploreTiles() {
    this.tiles.forEach((tile) => tile.explore(this.tiles, this.player));
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
      const building = Building.build(buildingType, this.player);
      if (this.player.canAfford(building.cost)) {
        this.player.pay(building.cost);
        tile.build(building);
      } else {
        console.log("Cannot afford building");
      }
    }
  }

  placePeasant({ x, y }: Coordinate) {
    const tile = this.findTile({ x, y });
    if (!tile) return;

    if (tile.building?.type === BuildingType.house) {
      tile.place(Piece.peasant(this.player));
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
      tile.piece = Piece.archer(this.player);
      return;
    }
  }
}
