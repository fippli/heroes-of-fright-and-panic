import { describe, expect, it } from "vitest";
import { normalizePiece, parseGameState } from "./GameParser";
import { PieceKind } from "@shared/piece";
import { LandscapeType } from "./Landscape";
import type { ServerGameState } from "./GameTypes";

describe("normalizePiece", () => {
  it("fills equipment/steed/base stats for legacy pieces that lack them", () => {
    const piece = normalizePiece({ kind: PieceKind.king, owner: "night" });
    expect(piece.equipment).toEqual([]);
    expect(piece.steed).toBeNull();
    expect(piece.baseView).toBe(2);
    expect(piece.owner).toBe("night");
  });

  it("keeps fields the server did send", () => {
    const piece = normalizePiece({
      kind: PieceKind.peasant,
      owner: "day",
      hearts: 0,
      baseAttack: 5,
      equipment: [{ type: "bow", attackRangeBonus: 1 }],
    });
    expect(piece.hearts).toBe(0);
    expect(piece.baseAttack).toBe(5);
    expect(piece.equipment).toHaveLength(1);
  });
});

describe("parseGameState", () => {
  it("keeps a steed lying on a tile", () => {
    const game = {
      id: "g1", size: 1, currentPlayer: "day", clock: { time: 6 },
      dayPlayer: { type: "day", resources: {} }, nightPlayer: { type: "night", resources: {} },
      tiles: [{ row: 0, column: 0, landscape: { type: LandscapeType.grass }, building: null, piece: null, steed: { type: "horse" } }],
    } as unknown as ServerGameState;
    expect(parseGameState(game).tiles[0].steed).toBe("horse");
  });

  it("parses a legacy game whose pieces have no equipment field", () => {
    const game: ServerGameState = {
      id: "g1",
      size: 1,
      currentPlayer: "day",
      clock: { time: 6 },
      dayPlayer: { type: "day", resources: {} },
      nightPlayer: { type: "night", resources: {} },
      tiles: [
        {
          row: 0,
          column: 0,
          landscape: { type: LandscapeType.grass },
          building: null,
          piece: { kind: PieceKind.peasant, owner: "day" },
        },
      ],
    } as unknown as ServerGameState;

    const parsed = parseGameState(game);
    const piece = parsed.tiles[0].piece;
    expect(piece).toBeDefined();
    expect(piece?.walkableLandscape).toContain(LandscapeType.grass);
    expect(piece?.walkableLandscape).not.toContain(LandscapeType.tree);
  });
});
