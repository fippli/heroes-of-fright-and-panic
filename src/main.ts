import { Canvas } from "./canvas";
import { Board } from "./core/Board";
import { BuildingType, type Building } from "./core/Building";
import { Landscape } from "./core/Landscape";
import { Piece } from "./core/Piece";
import { Player } from "./core/Player";
import { Tile } from "./core/Tile";
import "./style.css";

const timeElement = document.getElementById("time") as HTMLDivElement;

const housesElement = document.getElementById("houses") as HTMLDivElement;
const towersElement = document.getElementById("towers") as HTMLDivElement;
const castlesElement = document.getElementById("castles") as HTMLDivElement;

const setTime = (time: number) => {
  timeElement.textContent = `${time % 24}:00`;
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

const SIZE = 21;
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
        explored: true,
        landscape: Landscape.grass(),
        piece: Piece.peasant(),
      });
    } else {
      return new Tile({
        col,
        row,
        landscape: null,
      });
    }
  });
};

const tiles = createBoard(SIZE);

const board = new Board({
  tiles,
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
  a: () => board.upgradeArcher(Piece.archer(), canvas.mousePosition),
  h: () => board.build(BuildingType.house, canvas.mousePosition),
  t: () => board.build(BuildingType.tower, canvas.mousePosition),
  c: () => board.build(BuildingType.castle, canvas.mousePosition),
  b: () => board.build(BuildingType.boat, canvas.mousePosition),
  f: () => board.build(BuildingType.farm, canvas.mousePosition),
  p: () => board.placePiece(Piece.peasant(), canvas.mousePosition),
  u: () => board.upgrade(canvas.mousePosition),
});

loop();
