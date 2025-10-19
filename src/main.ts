import { Board } from "./core/Board";
import { BuildingType, type Building } from "./core/Building";
import { Hexagon } from "./core/Hexagon";
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

const healthBarFillElement = document.getElementById(
  "health-bar-fill",
) as HTMLDivElement;

const housesElement = document.getElementById("houses") as HTMLDivElement;
const towersElement = document.getElementById("towers") as HTMLDivElement;
const castlesElement = document.getElementById("castles") as HTMLDivElement;

const setTime = (time: number) => {
  timeElement.textContent = `${time % 24}:00`;
};

const setHealth = (currentHealth: number, maxHealth: number) => {
  healthBarFillElement.style.width = `${(currentHealth / maxHealth) * 100}%`;
};

const setFood = (currentFood: number) => {
  foodElement.textContent = `${currentFood}`;
};

const setResources = (wood: number, stone: number, gold: number) => {
  woodElement.textContent = wood.toString();
  stoneElement.textContent = stone.toString();
  goldElement.textContent = gold.toString();
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

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

const canvasWrapper = document.querySelector(
  ".canvas-wrapper",
) as HTMLDivElement;

canvas.width = canvasWrapper.clientWidth;
canvas.height = canvasWrapper.clientHeight;

let mousePosition = { x: Infinity, y: Infinity };

const SIZE = 33;
const startRow = Math.floor(SIZE / 2);
const startCol = Math.floor(SIZE / 2);

// translate the center of the canvas to the center of the board
let translation = {
  x: -Hexagon.x(startRow, startCol) + canvasWrapper.clientWidth / 2,
  y: -Hexagon.y(startRow) + canvasWrapper.clientHeight / 2,
};

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
  buildings: [],
  pieces: [Piece.peasant({ row: startRow, col: startCol })],
  player: new Player({ row: startRow, col: startCol }),
});

const loop = () => {
  board.calculateNextState();

  if (!ctx) return;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.translate(translation.x, translation.y);

  board.render(ctx);

  const hoveredTile = board.tiles.find((tile) => {
    return tile.isMouseOver(
      mousePosition.x - translation.x,
      mousePosition.y - translation.y,
    );
  });

  if (hoveredTile) {
    hoveredTile.renderHovered(ctx);
  }

  ctx.resetTransform();

  setTime(board.time);
  setHealth(board.player.currentHealth, board.player.maxHealth);
  setFood(board.player.currentFood, board.player.maxFood);
  setResources(board.player.wood, board.player.stone, board.player.gold);
  setBuildings(board.buildings);

  requestAnimationFrame(loop);
};

canvas.addEventListener("mousemove", (event) => {
  mousePosition = {
    x: event.clientX,
    y: event.clientY,
  };
});

window.addEventListener("keydown", (event) => {
  event.preventDefault();

  const speed = 25;
  switch (event.key) {
    case "ArrowLeft": {
      return (translation = { ...translation, x: translation.x + speed });
    }
    case "ArrowRight": {
      return (translation = { ...translation, x: translation.x - speed });
    }
    case "ArrowUp": {
      return (translation = { ...translation, y: translation.y + speed });
    }
    case "ArrowDown": {
      return (translation = { ...translation, y: translation.y - speed });
    }

    case "h": {
      return board.build(BuildingType.house, {
        x: mousePosition.x - translation.x,
        y: mousePosition.y - translation.y,
      });
    }
    case "t": {
      return board.build(BuildingType.tower, {
        x: mousePosition.x - translation.x,
        y: mousePosition.y - translation.y,
      });
    }
    case "c": {
      return board.build(BuildingType.castle, {
        x: mousePosition.x - translation.x,
        y: mousePosition.y - translation.y,
      });
    }

    case "b": {
      return board.build(BuildingType.boat, {
        x: mousePosition.x - translation.x,
        y: mousePosition.y - translation.y,
      });
    }

    default: {
      return;
    }
  }
});

window.addEventListener("onKeyUp", (event) => {
  event.preventDefault();
});

window.addEventListener("click", (event) => {
  event.preventDefault();
  board.click({
    x: event.clientX - translation.x,
    y: event.clientY - translation.y,
  });
});

loop();
