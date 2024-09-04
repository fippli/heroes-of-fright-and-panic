import { useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { faTree } from "@fortawesome/free-solid-svg-icons";
import { useEffect } from "react";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { faCarrot } from "@fortawesome/free-solid-svg-icons";

import * as Tiles from "./tiles.js";
import { compose, groupWithSize, unfold } from "./utils.js";

const START_SIZE = 5;

const initialState = {
  size: START_SIZE,
  villagers: 0,
  time: 0,
  wood: 0,
  food: 0,
  rows: [
    Array.from({ length: START_SIZE }, () => Tiles.unexplored),
    Array.from({ length: START_SIZE }, () => Tiles.unexplored),
    [Tiles.unexplored, Tiles.wood, Tiles.home, Tiles.wood, Tiles.unexplored],
    [Tiles.unexplored, Tiles.wood, Tiles.player, Tiles.wood, Tiles.unexplored],
    [Tiles.unexplored, Tiles.wood, Tiles.wood, Tiles.wood, Tiles.unexplored],
  ],
};

const increaseMapSize = (state) => {
  return { ...state, size: state.size + 2 };
};

const expandMap = (state) => {
  return {
    ...state,
    rows: [
      Array.from({ length: state.size }, () => Tiles.unexplored),
      ...state.rows.map((row) => [Tiles.unexplored, ...row, Tiles.unexplored]),
      Array.from({ length: state.size }, () => Tiles.unexplored),
    ],
  };
};

export const App = () => {
  const [state, setState] = useState(initialState);
  const [hoveredTile, setHoveredTile] = useState(null);

  useEffect(() => {
    console.log({ hoveredTile });
    if (unfold(state.rows).every((tile) => tile.type !== "unexplored")) {
      console.log("all discovered");

      setState(compose(increaseMapSize, expandMap));
    }
  }, [hoveredTile, state.rows]);

  const clickTile = (tile) => {
    const passTime = (state) => ({ ...state, time: state.time + 1 });

    const flipTile = (state) => {
      const tiles = unfold(state.rows);

      const updatedTiles = tiles.map((t, i) => {
        if (i === tile.index) {
          return Tiles.flip(tile);
        } else {
          return t;
        }
      });

      return {
        ...state,
        ...tile.effect(state),
        rows: groupWithSize(updatedTiles, state.size),
      };
    };

    setState(compose(passTime, flipTile));
  };

  return (
    <div className="layout">
      <div className="board">
        <div
          style={{
            width: `${state.size * 64}px`,
            height: `${state.size * 64}px`,
            display: "grid",
            gridTemplateColumns: `repeat(${state.size}, 1fr)`,
            gridTemplateRows: `repeat(${state.size}, 1fr)`,
            margin: "0 auto",
          }}
        >
          {unfold(state.rows).map((tile, tileIndex) => {
            return (
              <Tile
                key={tileIndex}
                {...tile}
                index={tileIndex}
                onClick={clickTile}
                onMouseEnter={() => setHoveredTile(tile)}
                onMouseMove={() => setHoveredTile(tile)}
              />
            );
          })}
        </div>
      </div>

      <div className="menu">
        <div>
          <FontAwesomeIcon icon={faUser} />
          &nbsp;{state.villagers}
        </div>
        <div>
          <FontAwesomeIcon icon={faClock} />
          &nbsp;{state.time}
        </div>
        <div>
          <FontAwesomeIcon icon={faCarrot} />
          &nbsp;{state.food}
        </div>
        <div>
          <FontAwesomeIcon icon={faTree} />
          &nbsp;{state.wood}
        </div>
        <div>{hoveredTile?.type}</div>
      </div>
    </div>
  );
};

const Tile = ({ onMouseEnter, onMouseMove, ...tile }) => {
  return (
    <div
      className="tile"
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      style={{
        backgroundColor: tile.backgroundColor,
        color: tile.color,
      }}
      onClick={() => tile.onClick(tile)}
    >
      <FontAwesomeIcon icon={tile.icon} />
    </div>
  );
};
