import { Canvas } from "./canvas";
import { Board } from "./core/Board";
import { BuildingType, type Building, type ResourceMap } from "./core/Building";
import { Landscape } from "./core/Landscape";
import { Piece } from "./core/Piece";
import { Player } from "./core/Player";
import { Tile } from "./core/Tile";
import "./style.css";

const timeElement = document.getElementById("time") as HTMLDivElement;
const woodElement = document.getElementById("wood") as HTMLDivElement;
const stoneElement = document.getElementById("stone") as HTMLDivElement;
const goldElement = document.getElementById("gold") as HTMLDivElement;
const foodElement = document.getElementById("food") as HTMLDivElement;

const housesElement = document.getElementById("houses") as HTMLDivElement;
const towersElement = document.getElementById("towers") as HTMLDivElement;
const castlesElement = document.getElementById("castles") as HTMLDivElement;

const setTime = (time: number) => {
  timeElement.textContent = `${time % 24}:00`;
};

const setResources = (resources: ResourceMap = {}) => {
  woodElement.textContent = resources.wood?.toString() ?? "0";
  stoneElement.textContent = resources.stone?.toString() ?? "0";
  goldElement.textContent = resources.gold?.toString() ?? "0";
  foodElement.textContent = resources.food?.toString() ?? "0";
};

const setBuildings = (buildings: Building[]) => {
  const houses = buildings.filter(
    (building) => building.type === BuildingType.house,
  ).length;
  const towers = buildings.filter(
    (building) => building.type === BuildingType.tower,
  ).length;
  const castles = buildings.filter(
    (building) => building.type === BuildingType.castle,
  ).length;
  housesElement.textContent = houses.toString();
  towersElement.textContent = towers.toString();
  castlesElement.textContent = castles.toString();
};

const canvas = new Canvas();

const SIZE = 33;
const startRow = Math.floor(SIZE / 2);
const startCol = Math.floor(SIZE / 2);

// translate the center of the canvas to the center of the board

const createBoard = (columns: number) => {
  const numberOfTiles = columns * columns;
  return Array.from({ length: numberOfTiles }, (_, tileNumber) => {
    const col = tileNumber % columns;
    const row = Math.floor(tileNumber / columns);

    if (row === startRow && col === startCol) {
      return new Tile({
        col,
        row,
        landscape: Landscape.grass(),
        explored: true,
        piece: Piece.peasant({ row: startRow, col: startCol }),
      });
    } else {
      return new Tile({
        col,
        row,
        landscape: null,
      });
    }
  }).map((tile) => {
    if (tile.isNeighborTo({ row: startRow, col: startCol })) {
      tile.explored = true;
      tile.landscape = Landscape.grass();
    }
    return tile;
  });
};

const tiles = createBoard(SIZE);

const board = new Board({
  tiles,
  // buildings: [],
  // pieces: [Piece.peasant({ row: startRow, col: startCol })],
  player: new Player({ row: startRow, col: startCol }),
});

const loop = () => {
  board.calculateNextState();

  if (!canvas.ctx) return;

  canvas.init();

  board.render(canvas.ctx);

  const hoveredTile = board.tiles.find((tile) => {
    return tile.isMouseOver(canvas.mousePosition.x, canvas.mousePosition.y);
  });

  if (hoveredTile) {
    hoveredTile.renderHovered(canvas.ctx);
  }

  canvas.reset();

  setTime(board.time);
  setResources(board.player.resources);
  setBuildings(
    board.tiles
      .filter((tile) => tile.building)
      .flatMap((tile) => tile?.building ?? []),
  );

  requestAnimationFrame(loop);
};

canvas.click(({ x, y }: { x: number; y: number }) => {
  board.click({
    x,
    y,
  });
});

canvas.keydown({
  h: () =>
    board.build(BuildingType.house, {
      x: canvas.mousePosition.x,
      y: canvas.mousePosition.y,
    }),
  t: () =>
    board.build(BuildingType.tower, {
      x: canvas.mousePosition.x,
      y: canvas.mousePosition.y,
    }),
  c: () =>
    board.build(BuildingType.castle, {
      x: canvas.mousePosition.x,
      y: canvas.mousePosition.y,
    }),
  b: () =>
    board.build(BuildingType.boat, {
      x: canvas.mousePosition.x,
      y: canvas.mousePosition.y,
    }),
  f: () =>
    board.build(BuildingType.farm, {
      x: canvas.mousePosition.x,
      y: canvas.mousePosition.y,
    }),
});

loop();
