import { faHouse } from "@fortawesome/free-solid-svg-icons";
import { faQuestion } from "@fortawesome/free-solid-svg-icons";
import { faTree } from "@fortawesome/free-solid-svg-icons";
import { faDotCircle } from "@fortawesome/free-regular-svg-icons";
import { faCow } from "@fortawesome/free-solid-svg-icons";
import { identity } from "./utils.js";
import { faGhost } from "@fortawesome/free-solid-svg-icons";
import { faFireAlt } from "@fortawesome/free-solid-svg-icons";
import { faSailboat } from "@fortawesome/free-solid-svg-icons";
import { faPerson } from "@fortawesome/free-solid-svg-icons";
import { faDog } from "@fortawesome/free-solid-svg-icons";

export const unexplored = {
  icon: faQuestion,
  type: "unexplored",
  backgroundColor: "#000000",
  color: "#ffffff",
  effect: identity,
};

export const grass = {
  icon: faDotCircle,
  type: "grass",
  backgroundColor: "#00ff00",
  color: "#00ff00",
  effect: identity,
};

export const wood = {
  icon: faTree,
  type: "tree",
  backgroundColor: "darkgreen",
  color: "#00ff00",
  effect: (state) => ({ ...state, wood: state.wood + 1 }),
};

export const cow = {
  icon: faCow,
  type: "cow",
  backgroundColor: "#00ff00",
  color: "brown",
  effect: (state) => ({ ...state, food: state.food + 1 }),
};

export const player = {
  icon: faPerson,
  type: "player",
  backgroundColor: "#00ff00",
  color: "black",
  effect: identity,
};

export const dirt = {
  icon: faDotCircle,
  type: "dirt",
  backgroundColor: "#ffff00",
  color: "#ffff00",
  effect: identity,
};

export const home = {
  icon: faHouse,
  backgroundColor: "#00ff00",
  color: "brown",
  type: "home",
  effect: (state) => ({ ...state, villagers: state.villagers + 1 }),
};

export const ghost = {
  icon: faGhost,
  backgroundColor: "darkgray",
  color: "white",
  type: "ghost",
  effect: identity, // TODO: move towards center
};

export const dog = {
  icon: faDog,
  backgroundColor: "#00ff00",
  color: "brown",
  type: "dog",
  effect: identity, // TODO: move towards center
};

export const fire = {
  icon: faFireAlt,
  backgroundColor: "red",
  color: "orange",
  type: "fire",
  effect: identity, // TODO: move towards center
};

export const water = {
  icon: faDotCircle,
  type: "water",
  backgroundColor: "#0000ff",
  color: "#0000ff",
  effect: (state) => ({
    ...state,
    villagers: state.villagers - 1,
    wood: state.wood - 1,
  }),
};

export const boat = {
  icon: faSailboat,
  type: "water",
  backgroundColor: "#0000ff",
  color: "brown",
  effect: identity,
};

const natureTiles = [wood, grass, wood, fire, wood, water, wood];

const forrestTiles = [grass, grass, dog];

export const randomFrom = (xs) => xs[Math.floor(Math.random() * xs.length)];

export const flip = (tile) => {
  switch (tile.type) {
    case "unexplored": {
      return wood;
      // return randomFrom(natureTiles);
    }

    case "home": {
      return tile;
    }

    case "tree": {
      return randomFrom(forrestTiles);
    }

    case "grass": {
      return cow;
    }

    case "cow": {
      return dirt;
    }

    case "water": {
      return boat;
    }

    default: {
      console.log("> Tile is not unexplored");
      return tile;
    }
  }
};
