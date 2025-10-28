import { Canvas } from "./canvas";
import { Board } from "./core/Board";
import { BuildingType } from "./core/Building";

import "./style.css";
import type { Coordinate } from "./types/coordinate";

const canvas = new Canvas();
const board = new Board(canvas);

// get game Id from path parameter
const gameId = window.location.pathname.split("/").pop();
console.log(gameId);

fetch(`/api/game/${gameId}`)
  .then((response) => response.json())
  .then((game) => {
    console.log(game);
    board.parseTiles(game.board.tiles);
    loop();
  });

const loop = () => {
  board.calculateNextState(canvas);

  if (!canvas.ctx) {
    return;
  }

  canvas.init();
  board.render();
  canvas.reset();

  requestAnimationFrame(loop);
};

canvas.click((position: Coordinate) => board.click(position));

canvas.keydown({
  a: (position) => board.upgradeArcher(position),
  h: (position) => board.build(BuildingType.house, position),
  t: (position) => board.build(BuildingType.tower, position),
  c: (position) => board.build(BuildingType.castle, position),
  b: (position) => board.build(BuildingType.boat, position),
  f: (position) => board.buildFarm(position),
  p: (position) => board.createPeasant(position),
  u: (position) => board.upgrade(position),
  x: (position) => board.attack(position),
});

loop();
