import type { Canvas } from "../canvas";
import type { Coordinate } from "../types/coordinate";
import { compose } from "../utils/compose";
import { Building, BuildingType } from "./Building";
import { Clock } from "./Clock";
import { Dialog } from "./Dialog";
import { Hexagon } from "./Hexagon";
import { Landscape, LandscapeType } from "./Landscape";
import { Piece, PieceType } from "./Piece";

import { Player } from "./Player";
import { ResourceMap } from "./ResourceMap";
import { Tile } from "./Tile";

const dialog = new Dialog();

export class Game {
  id: string;
  canvas: Canvas;
  tiles: Tile[];
  clock: Clock = new Clock();
  player: Player;

  dayPlayer: Player;
  nightPlayer: Player;

  selectedTile: Tile | undefined | null = undefined;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.tiles = [];

    this.dayPlayer = new Player({ type: "day" });
    this.nightPlayer = new Player({ type: "night" });

    // this.player = this.dayPlayer;
  }

  parse(game: {
    id: string;
    size: number;
    player: Player;
    dayPlayer: Player;
    nightPlayer: Player;
    tiles: {
      row: number;
      column: number;
      landscape: { type: LandscapeType; lootDrop?: ResourceMap };
      building: Building;
      piece: Piece;
    }[];
  }) {
    this.id = game.id;
    this.player = new Player(game.player);
    this.dayPlayer = new Player(game.dayPlayer);
    this.nightPlayer = new Player(game.nightPlayer);

    this.tiles = game.tiles.map(
      (tile) =>
        new Tile({
          row: tile.row,
          column: tile.column,
          landscape: new Landscape(tile.landscape),
          building: tile.building,
          piece: tile.piece ? new Piece(tile.piece) : undefined,
        }),
    );

    console.log("board parsed", this.tiles);
  }

  render() {
    const canvas = this.canvas;
    canvas.ctx.save();

    this.tiles.forEach((tile: Tile) => {
      tile.render(canvas.ctx);
    });

    if (this.selectedTile) {
      this.selectedTile.renderArea(canvas.ctx, this.tiles);
      Hexagon.render(
        canvas.ctx,
        this.selectedTile.x,
        this.selectedTile.y,
        "#00ffff",
      );
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
      const column = tileNumber % size;
      const row = Math.floor(tileNumber / size);

      return new Tile({ column, row });
    }) as Tile[];

    const mapTiles = startTiles.reduce((acc, tile) => {
      const newTile = tile.giveLandscape(
        Landscape.generate(tile.getNeighbors(acc)),
      );
      return acc.map((tile) =>
        tile.row === newTile.row && tile.column === newTile.column
          ? newTile
          : tile,
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
      t.row === tile.row && t.column === tile.column ? tile : t,
    );
  }

  exploreTiles() {
    this.tiles.forEach((tile) => tile.explore(this.tiles, this.player));
  }

  unExploredTiles() {
    this.tiles.filter((tile) => tile.unexplore());
  }

  calculateNextState(_canvas: Canvas) {
    this.unExploredTiles();
    this.exploreTiles();

    this.clock.dusk(() => {
      this.selectedTile = undefined;
      dialog.open({ title: "Dusk", content: "The sun is setting" });
      const production = this.nightPlayer.produce(this.tiles);
      this.nightPlayer.collect(production);
    });

    this.clock.dawn(() => {
      this.selectedTile = undefined;
      dialog.open({ title: "Dawn", content: "The sun is rising" });

      const production = this.dayPlayer.produce(this.tiles);
      this.dayPlayer.collect(production);
    });

    if (this.clock.isNight()) {
      this.player = this.nightPlayer;
    } else {
      this.player = this.dayPlayer;
    }
  }

  findTile(pos: { x: number; y: number } | { row: number; column: number }) {
    if ("x" in pos && "y" in pos) {
      return this.tiles.find((tile) => {
        return tile.isMouseOver(pos.x, pos.y);
      });
    } else {
      return this.tiles.find((tile) => {
        return tile.row === pos.row && tile.column === pos.column;
      });
    }
  }

  click({ x, y }: { x: number; y: number }) {
    fetch(`/api/game/${this.id}/click`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ x, y }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
      });

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
        if (this.selectedTile.canLoot(clickedTile)) {
          const { lootDrop, nextLandscape } = clickedTile.loot();
          this.player.collect(lootDrop);
          clickedTile.landscape = nextLandscape;
          this.clock.tick();
          return;
        }

        if (this.selectedTile.canWalkOn(clickedTile)) {
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
      if (building) {
        tile.build(building);
        this.clock.tick();
      }
    }
  }

  buildFarm({ x, y }: Coordinate) {
    const tile = this.findTile({ x, y });
    if (!tile) return;

    const isNeighborToHouse = tile.getNeighbors(this.tiles).some((tile) => {
      return tile.building?.type === BuildingType.house;
    });

    if (
      isNeighborToHouse &&
      this.selectedTile?.building?.type === BuildingType.house &&
      this.selectedTile.building.owner === this.player &&
      this.selectedTile.piece?.type === PieceType.peasant
    ) {
      tile.build(Building.farm(this.player));
      this.clock.tick();
      return;
    }
  }

  createPeasant({ x, y }: Coordinate) {
    const tile = this.findTile({ x, y });
    if (!tile) return;

    if (tile.building?.type === BuildingType.house) {
      if (this.player.canAfford(Piece.costOfUpgrade(PieceType.peasant))) {
        this.player.pay(Piece.costOfUpgrade(PieceType.peasant));
        tile.place(Piece.peasant(this.player));
      } else {
        return;
      }
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

  attack({ x, y }: { x: number; y: number }) {
    const tile = this.findTile({ x, y });
    if (!tile) return;

    // if the piece is in range, attack the tile
    if (this.selectedTile?.inRangeOf(tile)) {
      tile.piece = undefined;
      return;
    }
  }
}
