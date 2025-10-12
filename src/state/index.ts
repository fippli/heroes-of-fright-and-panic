import { Board } from "../core/Board";
import { House } from "../core/House";
import { Player } from "../core/Player";
import { Tile } from "../core/Tile";
import { TileType } from "../core/TileType";
import { compose } from "../utils";
const SIZE = 13;

const createBoard = (columns: number) => {
  const numberOfTiles = columns * columns;
  return Array.from({ length: numberOfTiles }, (_, tileNumber) => {
    return new Tile({
      col: tileNumber % columns,
      row: Math.floor(tileNumber / columns),
    });
  });
};

export const initialState = {
  mapPosition: {

    x: 0,
    y: 0,
  },
  

  time: 8,
  
  contextMenu: null,
  
  resources: {
    wood: 0,
  },

  board: new Board({ tiles: createBoard(SIZE), landscapes: [], buildings: [], pieces: [], player: new Player({ row: Math.floor(SIZE / 2), col: Math.floor(SIZE / 2) }) }),
};

export type State = typeof initialState;

export type Action = Record<string, any>;

const actionSwitch = (state: State, action: Action) => {
  const [type, payload] = Object.entries<Action>(action).at(0);

  switch (type) {
    case "moveMap": {
      return {
        ...state,
        mapPosition: {
          ...state.mapPosition,
          x: state.mapPosition.x - payload.deltaX,
          y: state.mapPosition.y - payload.deltaY,
        },
      };
    }
    case "click": {
      const clickedTile = state.tiles.find((tile) =>
        tile.isMouseOver(payload.x, payload.y)
      );

      if (clickedTile?.isThis(state.player)) {
        return {
          ...state,
          contextMenu: null,
        };
      }

      if (clickedTile?.isNeighborTo(state.player)) {
        switch (clickedTile?.type) {
          case TileType.TREE: {
            return {
              ...state,
              time: (state.time + 1) % 24,
              resources: {
                ...state.resources,
                wood: state.resources.wood + 1,
              },
              tiles: state.tiles.map((tile: Tile) => {
                if (tile.isThis(clickedTile)) {
                  if (
                    (clickedTile.isNeighborToSand(state.tiles) &&
                      clickedTile.hasUnexploredNeighbor(state.tiles)) ||
                    clickedTile.isNeighborToWater(state.tiles)
                  ) {
                    return tile.exploreAs(TileType.SAND);
                  }
                  return tile.exploreAs(TileType.GRASS);
                }
                return tile;
              }),
            };
          }

          case TileType.GRASS: {
            return {
              ...state,
              time: (state.time + 1) % 24,
              contextMenu: null,
              player: state.player.place(clickedTile),
            };
          }

          case TileType.SAND: {
            return {
              ...state,
              time: (state.time + 1) % 24,
              contextMenu: null,
              player: state.player.place(clickedTile),
            };
          }

          default: {
            return {
              ...state,
              contextMenu: null,
            };
          }
        }
      }

      return state;
    }

    case "rightClick": {
      return {
        ...state,
        contextMenu: payload,
      };
    }

    case "initiate": {
      return compose(
        (state) => {
          return {
            ...state,
            tiles: state.tiles.map((tile: Tile) => {
              if (tile.isThis(state.player)) {
                return tile.exploreAs(TileType.GRASS);
              }
              if (tile.isNeighborTo(state.player)) {
                return tile.exploreAs(TileType.GRASS);
              }
              return tile;
            }),
          };
        },
        (state) => {
          return {
            ...state,
            tiles: state.tiles.map((tile: Tile) => {
              if (tile.hasExploredNeighbor(state.tiles) && !tile.explored) {
                return tile.exploreAs(TileType.TREE);
              }
              return tile;
            }),
          };
        },
        (state) => {
          return {
            ...state,
            buildings: [...state.buildings, new House(state.player)],
          };
        }
      )(state);
    }

    default: {
      return state;
    }
  }
};

export const reducer = (state: State, action: Action) => {
  const nextState = actionSwitch(state, action);

  console.log({ nextState });

  const result = compose((state) => {
    const currentPlayerTile = state.player.tile(state.tiles);

    return {
      ...state,
      tiles: state.tiles.map((tile: Tile) =>
        tile.isNeighborTo(currentPlayerTile) || tile.isThis(currentPlayerTile)
          ? tile.explore(state.tiles)
          : tile
      ),
    };
  })(nextState);

  console.log({ result });

  return result;
};
