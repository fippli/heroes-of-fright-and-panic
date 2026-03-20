import type { Canvas } from "../canvas";
import { type ImageAssets, defaultImageAssets } from "../images";
import type { Coordinate } from "../types/coordinate";
import { BuildingType } from "./Building";
import { Clock } from "./Clock";
import { parseGameState } from "./GameParser";
import type { PlayerType, ServerGameState } from "./GameTypes";
import { Hexagon } from "./Hexagon";
import { PieceKind } from "./Piece";
import { Player } from "./Player";
import { renderResources } from "./ResourceMap";
import { Tile } from "./Tile";
import { handleAction } from "@shared/game/engine.ts";
import { createGame } from "@shared/game/create-game.ts";
import type { Game as GameState } from "@shared/game/types.ts";
import type { GameAction } from "@shared/actions/index.ts";
import { EquipmentType } from "@shared/equipment/index.ts";

/**
 * DevGame - Local game for development/testing.
 * Runs the engine in the browser with no server dependency.
 * Both players are controlled from the same client.
 */
export class DevGame {
  readonly canvas: Canvas;
  tiles: Tile[] = [];
  clock: Clock = new Clock();
  currentPlayer: PlayerType = "day";
  dayPlayer: Player;
  nightPlayer: Player;
  selectedTile: Tile | undefined | null = undefined;
  gameOver: boolean = false;
  winner: PlayerType | null = null;
  imageAssets: ImageAssets;
  private gameState: GameState;
  private readonly logElement: HTMLElement | null;

  constructor(canvas: Canvas, size: number) {
    this.canvas = canvas;
    this.dayPlayer = new Player({ type: "day" });
    this.nightPlayer = new Player({ type: "night" });
    this.imageAssets = defaultImageAssets;
    this.logElement = document.getElementById("dev-log");

    const created = createGame({
      boardSize: size,
      name: "Dev Game",
      alliance: "day",
      creatorEmail: "dev@local",
      inviteEmail: null,
    });

    this.gameState = {
      id: "dev",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...created,
    };

    this.syncFromState();
    this.log(`Dev game created (${size}x${size}). Day player's turn.`);
    this.log("Click to select pieces. Use keyboard shortcuts to act.");
  }

  get player(): Player {
    return this.currentPlayer === "day" ? this.dayPlayer : this.nightPlayer;
  }

  // ============================================
  // STATE SYNC
  // ============================================

  private syncFromState(): void {
    const serverLike = this.gameState as unknown as ServerGameState;
    const parsed = parseGameState(serverLike);
    this.clock = parsed.clock;
    this.currentPlayer = parsed.currentPlayer;
    this.dayPlayer = parsed.dayPlayer;
    this.nightPlayer = parsed.nightPlayer;
    this.tiles = parsed.tiles;
    this.gameOver = parsed.gameOver;
    this.winner = parsed.winner;
  }

  // ============================================
  // ACTION DISPATCH
  // ============================================

  private dispatch(action: GameAction): void {
    const { game: updatedGame, result } = handleAction(this.gameState, action);

    if (result.success) {
      this.gameState = updatedGame;
      this.syncFromState();
      this.log(`[${action.player}] ${result.message ?? action.type}`);
    } else {
      this.log(`[${action.player}] Failed: ${result.error}`);
    }
  }

  // ============================================
  // RENDER
  // ============================================

  render(): void {
    const canvas = this.canvas;
    canvas.ctx.save();

    // In dev mode, show everything (no fog of war)
    this.tiles.forEach((tile) => (tile.explored = true));

    this.tiles.forEach((tile: Tile) => {
      tile.render(canvas.ctx, this.imageAssets);
    });

    if (this.selectedTile !== undefined && this.selectedTile !== null) {
      this.selectedTile.renderArea(canvas.ctx, this.tiles);
      this.selectedTile.renderValidMoves(canvas.ctx, this.tiles);
      this.selectedTile.renderValidAttacks(
        canvas.ctx,
        this.tiles,
        this.currentPlayer,
      );
      Hexagon.render(
        canvas.ctx,
        this.selectedTile.x,
        this.selectedTile.y,
        "#00ffff",
      );
    }

    const hoveredTile = this.findTile(canvas.mousePosition);
    if (hoveredTile !== undefined) {
      hoveredTile.renderHovered(canvas.ctx);
    }

    canvas.ctx.restore();

    renderResources(this.player.resources);
    this.clock.render(this.currentPlayer);
  }

  // ============================================
  // INPUT HANDLERS
  // ============================================

  click({ x, y }: Coordinate): void {
    const clickedTile = this.findTile({ x, y });
    if (clickedTile === undefined) return;

    const pos = { row: clickedTile.row, column: clickedTile.column };

    // Select own piece
    if (clickedTile.piece?.owner?.type === this.currentPlayer) {
      this.selectedTile = clickedTile;
      this.log(`Selected ${clickedTile.piece.kind} at (${pos.row},${pos.column})`);
      return;
    }

    // Select own building (no piece)
    if (
      clickedTile.building?.owner?.type === this.currentPlayer &&
      clickedTile.piece === undefined
    ) {
      this.selectedTile = clickedTile;
      this.log(`Selected ${clickedTile.building.type} at (${pos.row},${pos.column})`);
      return;
    }

    // Move or attack if we have a selection
    if (this.selectedTile !== undefined && this.selectedTile !== null) {
      const from = { row: this.selectedTile.row, column: this.selectedTile.column };

      // If target has an enemy piece or building, attack
      if (
        clickedTile.piece !== undefined &&
        clickedTile.piece !== null &&
        clickedTile.piece.owner?.type !== this.currentPlayer
      ) {
        this.dispatch({
          type: "attack",
          player: this.currentPlayer,
          attackerPosition: from,
          targetPosition: pos,
        });
        this.selectedTile = undefined;
        return;
      }

      if (
        clickedTile.building !== undefined &&
        clickedTile.building !== null &&
        clickedTile.building.owner?.type !== this.currentPlayer
      ) {
        this.dispatch({
          type: "attack",
          player: this.currentPlayer,
          attackerPosition: from,
          targetPosition: pos,
        });
        this.selectedTile = undefined;
        return;
      }

      // Otherwise move
      this.dispatch({
        type: "move",
        player: this.currentPlayer,
        from,
        to: pos,
      });

      // Re-select piece at new position
      const newTile = this.findTile(pos);
      if (newTile?.piece?.owner?.type === this.currentPlayer) {
        this.selectedTile = newTile;
      } else {
        this.selectedTile = undefined;
      }
      return;
    }

    // No selection — just select tile
    this.selectedTile = clickedTile;
  }

  build(buildingType: BuildingType, { x, y }: Coordinate): void {
    const tile = this.findTile({ x, y });
    if (tile === undefined) return;

    this.dispatch({
      type: "build",
      player: this.currentPlayer,
      buildingType,
      position: { row: tile.row, column: tile.column },
    });
  }

  spawnPeasant({ x, y }: Coordinate): void {
    const tile = this.findTile({ x, y });
    if (tile === undefined) return;

    this.dispatch({
      type: "spawnPeasant",
      player: this.currentPlayer,
      position: { row: tile.row, column: tile.column },
    });
  }

  craftSword({ x, y }: Coordinate): void {
    const tile = this.findTile({ x, y });
    if (tile === undefined) return;

    this.dispatch({
      type: "craftEquipment",
      player: this.currentPlayer,
      equipmentType: EquipmentType.sword,
      piecePosition: { row: tile.row, column: tile.column },
    });
  }

  craftShield({ x, y }: Coordinate): void {
    const tile = this.findTile({ x, y });
    if (tile === undefined) return;

    this.dispatch({
      type: "craftEquipment",
      player: this.currentPlayer,
      equipmentType: EquipmentType.shield,
      piecePosition: { row: tile.row, column: tile.column },
    });
  }

  craftBow({ x, y }: Coordinate): void {
    const tile = this.findTile({ x, y });
    if (tile === undefined) return;

    this.dispatch({
      type: "craftEquipment",
      player: this.currentPlayer,
      equipmentType: EquipmentType.bow,
      piecePosition: { row: tile.row, column: tile.column },
    });
  }

  attack({ x, y }: Coordinate): void {
    const tile = this.findTile({ x, y });
    if (tile === undefined) return;
    if (this.selectedTile === undefined || this.selectedTile === null) return;

    this.dispatch({
      type: "attack",
      player: this.currentPlayer,
      attackerPosition: {
        row: this.selectedTile.row,
        column: this.selectedTile.column,
      },
      targetPosition: { row: tile.row, column: tile.column },
    });
  }

  // ============================================
  // UTILITIES
  // ============================================

  private findTile(pos: { x: number; y: number }): Tile | undefined {
    return this.tiles.find((tile) => tile.isMouseOver(pos.x, pos.y));
  }

  private log(message: string): void {
    console.log(`[DEV] ${message}`);
    if (this.logElement !== null) {
      const line = document.createElement("div");
      line.textContent = message;
      this.logElement.prepend(line);
      // Keep only last 20 lines
      const children = Array.from(this.logElement.children);
      children.slice(20).forEach((child) => child.remove());
    }
  }
}
