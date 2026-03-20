import { describe, it, expect } from "vitest";
import * as hex from "@shared/map/hex.ts";
import { GameMap } from "@shared/map/map.ts";
import type { Tile } from "@shared/map/tile.ts";
import { Piece, PieceKind } from "@shared/piece/index.ts";
import { Player } from "@shared/player/index.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";
import { createGame } from "./create-game.ts";

describe("createGame", () => {
  it("generates a game with the correct board size", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    expect(game.tiles).toHaveLength(10 * 10);
    expect(game.size).toBe(10);
    expect(game.name).toBe("test");
  });

  it("generates tiles with landscape assigned to every tile", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    const tilesWithoutLandscape = game.tiles.filter(
      (tile) => tile.landscape === null || tile.landscape === undefined,
    );

    expect(tilesWithoutLandscape).toHaveLength(0);
  });

  it("places a king and peasant for each player", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    const tilesWithPieces = game.tiles.filter(
      (tile) => tile.piece !== null && tile.piece !== undefined,
    );

    expect(tilesWithPieces).toHaveLength(4);

    const dayKing = tilesWithPieces.find(
      (tile) => tile.piece?.owner === "day" && tile.piece?.kind === PieceKind.king,
    );
    const dayPeasant = tilesWithPieces.find(
      (tile) => tile.piece?.owner === "day" && tile.piece?.kind === PieceKind.peasant,
    );
    const nightKing = tilesWithPieces.find(
      (tile) => tile.piece?.owner === "night" && tile.piece?.kind === PieceKind.king,
    );
    const nightPeasant = tilesWithPieces.find(
      (tile) => tile.piece?.owner === "night" && tile.piece?.kind === PieceKind.peasant,
    );

    expect(dayKing).toBeDefined();
    expect(dayPeasant).toBeDefined();
    expect(nightKing).toBeDefined();
    expect(nightPeasant).toBeDefined();
  });

  it("places king and peasant on adjacent grass tiles", () => {
    const game = createGame({
      boardSize: 15,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    const dayKingTile = game.tiles.find(
      (tile) => tile.piece?.owner === "day" && tile.piece?.kind === PieceKind.king,
    )!;
    const dayPeasantTile = game.tiles.find(
      (tile) => tile.piece?.owner === "day" && tile.piece?.kind === PieceKind.peasant,
    )!;

    expect(hex.isNeighborTo(dayKingTile, dayPeasantTile)).toBe(true);

    const nightKingTile = game.tiles.find(
      (tile) => tile.piece?.owner === "night" && tile.piece?.kind === PieceKind.king,
    )!;
    const nightPeasantTile = game.tiles.find(
      (tile) => tile.piece?.owner === "night" && tile.piece?.kind === PieceKind.peasant,
    )!;

    expect(hex.isNeighborTo(nightKingTile, nightPeasantTile)).toBe(true);
  });

  it("places day player near bottom-left and night player near top-right", () => {
    const boardSize = 15;
    const game = createGame({
      boardSize,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    const dayKingTile = game.tiles.find(
      (tile) => tile.piece?.owner === "day" && tile.piece?.kind === PieceKind.king,
    );
    const nightKingTile = game.tiles.find(
      (tile) => tile.piece?.owner === "night" && tile.piece?.kind === PieceKind.king,
    );

    expect(dayKingTile).toBeDefined();
    expect(nightKingTile).toBeDefined();

    // Day starts near bottom-left (high row, low column)
    expect(dayKingTile!.row).toBeGreaterThan(boardSize / 2);
    expect(dayKingTile!.column).toBeLessThan(boardSize / 2);

    // Night starts near top-right (low row, high column)
    expect(nightKingTile!.row).toBeLessThan(boardSize / 2);
    expect(nightKingTile!.column).toBeGreaterThan(boardSize / 2);
  });

  it("initializes players with starting resources (5 wood, 2 stone)", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    expect(game.dayPlayer.resources.wood).toBe(5);
    expect(game.dayPlayer.resources.stone).toBe(2);
    expect(game.dayPlayer.resources.iron).toBe(0);
    expect(game.dayPlayer.resources.gold).toBe(0);
    expect(game.dayPlayer.resources.food).toBe(0);
    expect(game.dayPlayer.resources.faith).toBe(0);

    expect(game.nightPlayer.resources.wood).toBe(5);
    expect(game.nightPlayer.resources.stone).toBe(2);
  });

  it("assigns creator as day player when alliance is day", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: "invite@test.com",
    });

    expect(game.dayPlayerEmail).toBe("creator@test.com");
    expect(game.nightPlayerEmail).toBe("invite@test.com");
  });

  it("assigns creator as night player when alliance is night", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "night",
      creatorEmail: "creator@test.com",
      inviteEmail: "invite@test.com",
    });

    expect(game.dayPlayerEmail).toBe("invite@test.com");
    expect(game.nightPlayerEmail).toBe("creator@test.com");
  });

  it("sets null for unassigned player email when no invite", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    expect(game.dayPlayerEmail).toBe("creator@test.com");
    expect(game.nightPlayerEmail).toBeNull();
  });

  it("sets initial clock state", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    expect(game.clock).toEqual({ time: 6, hasDawned: true, hasDusked: false });
    expect(game.currentPlayer).toBe("day");
    expect(game.gameOver).toBe(false);
    expect(game.winner).toBeNull();
  });

  it("works with the small board size (25x25)", () => {
    const game = createGame({
      boardSize: 25,
      name: "small game",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    expect(game.tiles).toHaveLength(25 * 25);

    const tilesWithPieces = game.tiles.filter(
      (tile) => tile.piece !== null && tile.piece !== undefined,
    );
    expect(tilesWithPieces).toHaveLength(4); // king + peasant per player
  });

  it("produces a JSON-serializable game object", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    expect(() => JSON.stringify(game)).not.toThrow();

    const parsed = JSON.parse(JSON.stringify(game));
    expect(parsed.tiles).toHaveLength(100);
    expect(parsed.size).toBe(10);
    expect(parsed.name).toBe("test");
  });

  it("initializes players with empty research", () => {
    const game = createGame({
      boardSize: 10,
      name: "test",
      alliance: "day",
      creatorEmail: "creator@test.com",
      inviteEmail: null,
    });

    expect(game.dayPlayer.research.speedLevel).toBe(0);
    expect(game.dayPlayer.research.hasMiningII).toBe(false);
    expect(game.dayPlayer.research.hasMiningIII).toBe(false);
    expect(game.dayPlayer.research.hasQueen).toBe(false);

    expect(game.nightPlayer.research.speedLevel).toBe(0);
  });
});
