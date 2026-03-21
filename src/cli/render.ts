import type { Game } from "@shared/game/types.ts";
import type { Tile } from "@shared/map/tile.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import type { TilePosition } from "@shared/actions/index.ts";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const landscapeChar = (tile: Tile): string => {
  if (tile.landscape == null) return " ";

  switch (tile.landscape.type) {
    case LandscapeType.grass:
      return "\x1b[32m.\x1b[0m";
    case LandscapeType.tree:
      return "\x1b[32mT\x1b[0m";
    case LandscapeType.water:
      return "\x1b[34mW\x1b[0m";
    case LandscapeType.sand:
      return "\x1b[33mS\x1b[0m";
    case LandscapeType.mountain:
      return "\x1b[37mM\x1b[0m";
    case LandscapeType.unexplored:
      return "\x1b[90m#\x1b[0m";
    default:
      return " ";
  }
};

const pieceChar = (tile: Tile): string | null => {
  if (tile.piece == null) return null;

  const isDay = tile.piece.owner === "day";
  const color = isDay ? "\x1b[1;33m" : "\x1b[1;35m";
  const reset = "\x1b[0m";

  switch (tile.piece.kind) {
    case "peasant":
      return `${color}p${reset}`;
    case "king":
      return `${color}K${reset}`;
    case "priest":
      return `${color}r${reset}`;
    case "archAngel":
      return `${color}A${reset}`;
    default:
      return `${color}?${reset}`;
  }
};

const buildingChar = (tile: Tile): string | null => {
  if (tile.building == null) return null;

  const isDay = tile.building.owner === "day";
  const color = isDay ? "\x1b[1;33m" : "\x1b[1;35m";
  const reset = "\x1b[0m";

  switch (tile.building.type) {
    case "house":
      return `${color}H${reset}`;
    case "castle":
      return `${color}C${reset}`;
    case "tower":
      return `${color}T${reset}`;
    case "wall":
      return `${color}W${reset}`;
    case "church":
      return `${color}X${reset}`;
    default:
      return `${color}?${reset}`;
  }
};

const tileChar = (tile: Tile): string => {
  const piece = pieceChar(tile);
  if (piece !== null) return piece;

  const building = buildingChar(tile);
  if (building !== null) return building;

  return landscapeChar(tile);
};

const charForTile = (
  tiles: ReadonlyArray<Tile>,
  row: number,
  column: number,
  selected: TilePosition | undefined,
): string => {
  const tile = tiles.find(
    (t) => t.row === row && t.column === column,
  );
  if (tile === undefined) return " ";

  const isSelected =
    selected !== undefined &&
    selected.row === row &&
    selected.column === column;

  const ch = tileChar(tile);
  return isSelected ? `\x1b[7m${ch}\x1b[0m` : ch;
};

/**
 * Render the board as a hex grid:
 *
 *        0   1   2
 *       / \ / \ / \
 *    0 | · | ♣ | ≈ |
 *       \ / \ / \ / \
 *    1   | ♣ | p | · |
 *       / \ / \ / \ /
 *    2 | H | · | ▲ |
 *       \ / \ / \ /
 */
export const renderBoard = (game: Game, selected?: TilePosition): string => {
  const { size, tiles } = game;
  const lines: string[] = [];

  const labelWidth = size >= 100 ? 4 : size >= 10 ? 3 : 2;
  const pad = " ".repeat(labelWidth + 1);

  // Column header
  const colHeaderChars: string[] = Array.from(
    { length: size * 4 + 2 },
    () => " ",
  );
  Array.from({ length: size }, (_, col) => {
    const centerX = col * 4 + 2;
    const label = col.toString();
    const startX = centerX - Math.floor(label.length / 2);
    Array.from(label, (char, charIndex) => {
      const position = startX + charIndex;
      if (position >= 0 && position < colHeaderChars.length) {
        colHeaderChars[position] = char;
      }
    });
  });
  lines.push(`${pad} ${colHeaderChars.join("")}`);

  Array.from({ length: size }, (_, row) => {
    const isEven = row % 2 === 0;
    const rowLabel = row.toString().padStart(labelWidth);

    // Top separator (only for first row)
    if (row === 0) {
      const sep = Array.from({ length: size }, () => `${DIM} / \\${RESET}`).join("");
      lines.push(`${pad}${sep}`);
    }

    // Content line
    const content = Array.from({ length: size }, (_, col) => {
      const ch = charForTile(tiles, row, col, selected);
      return `${DIM}|${RESET} ${ch} `;
    }).join("") + `${DIM}|${RESET}`;

    if (isEven) {
      lines.push(`${rowLabel} ${content}`);
    } else {
      lines.push(`${rowLabel}   ${content}`);
    }

    // Bottom separator / transition
    if (row < size - 1) {
      if (isEven) {
        const sep = Array.from({ length: size }, () => `${DIM} \\ /${RESET}`).join("") + `${DIM} \\${RESET}`;
        lines.push(`${pad}${sep}`);
      } else {
        const sep = Array.from({ length: size }, () => `${DIM} / \\${RESET}`).join("") + `${DIM} /${RESET}`;
        lines.push(`${pad}${sep}`);
      }
    } else {
      if (isEven) {
        const sep = Array.from({ length: size }, () => `${DIM} \\ /${RESET}`).join("");
        lines.push(`${pad}${sep}`);
      } else {
        const sep = Array.from({ length: size }, () => `${DIM} \\ /${RESET}`).join("");
        lines.push(`${pad}  ${sep}`);
      }
    }
  });

  return lines.join("\n");
};

export const renderResources = (game: Game, playerType: "day" | "night"): string => {
  const player = playerType === "day" ? game.dayPlayer : game.nightPlayer;
  const resources = player.resources;

  return [
    `Wood: ${resources.wood}`,
    `Stone: ${resources.stone}`,
    `Gold: ${resources.gold}`,
    `Food: ${resources.food}`,
  ].join("  ");
};

export const renderStatus = (game: Game): string => {
  const clock = game.clock;
  const hours = (clock.time % 24).toString().padStart(2, "0");
  const period = clock.time >= 6 && clock.time < 18 ? "day" : "night";

  const lines = [
    `Turn: ${game.currentPlayer} | Clock: ${hours}:00 (${period})`,
    `Day   — ${renderResources(game, "day")}`,
    `Night — ${renderResources(game, "night")}`,
  ];

  if (game.gameOver === true) {
    lines.push(`\x1b[1mGame Over! ${game.winner} wins!\x1b[0m`);
  }

  return lines.join("\n");
};

export const renderTileInfo = (tile: Tile): string => {
  const parts = [`(${tile.row},${tile.column})`];

  if (tile.landscape != null) {
    parts.push(`terrain: ${tile.landscape.type}`);
  }

  if (tile.building != null) {
    parts.push(`building: ${tile.building.type} [${tile.building.owner}]`);
  }

  if (tile.piece != null) {
    parts.push(`unit: ${tile.piece.kind} [${tile.piece.owner}]`);
  }

  return parts.join(" | ");
};
