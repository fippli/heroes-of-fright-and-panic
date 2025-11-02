import { Canvas } from "./canvas";
import { Game } from "./core/Board";
import { BuildingType } from "./core/Building";

import "./style.css";
import type { Coordinate } from "./types/coordinate";

const canvas = new Canvas();
const game = new Game(canvas);

// get game Id from path parameter
const gameId = window.location.pathname.split("/").pop();

fetch(`/api/game/${gameId}`)
  .then((response) => response.json())
  .then((gameData) => {
    game.parse(gameData);
    console.log(game);
    console.log(game.tiles.filter((t) => t.piece));
    loop();
  });

const loop = () => {
  game.calculateNextState(canvas);

  if (!canvas.ctx) {
    return;
  }

  canvas.init();
  game.render();
  canvas.reset();

  requestAnimationFrame(loop);
};

canvas.click((position: Coordinate) => game.click(position));

canvas.keydown({
  a: (position) => game.upgradeArcher(position),
  h: (position) => game.build(BuildingType.house, position),
  t: (position) => game.build(BuildingType.tower, position),
  c: (position) => game.build(BuildingType.castle, position),
  b: (position) => game.build(BuildingType.boat, position),
  f: (position) => game.buildFarm(position),
  p: (position) => game.createPeasant(position),
  u: (position) => game.upgrade(position),
  x: (position) => game.attack(position),
});
