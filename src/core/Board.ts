import type { Canvas } from "../canvas";
import type { Coordinate } from "../types/coordinate";
import { BuildingType } from "./Building";
import { Clock } from "./Clock";
import { Dialog } from "./Dialog";
import { GameClient } from "./GameClient";
import { parseGameState } from "./GameParser";
import type {
  GameAction,
  PlayerType,
  ServerGameState,
} from "./GameTypes";
import { Hexagon } from "./Hexagon";
import { Notifications } from "./Notifications";
import { PieceType } from "./Piece";
import { Player } from "@shared/player";
import { ResourceMap } from "@shared/player/resource-map";
import { Tile } from "./Tile";

/**
 * Game class - Client-side render-only implementation
 * All game logic is handled on the server.
 * This class only:
 * - Renders the game state
 * - Sends user inputs to the server
 * - Parses server responses
 */
export class Game {
  id: string = "";
  canvas: Canvas;
  tiles: Tile[] = [];
  clock: Clock = new Clock();
  private readonly dialog: Dialog;

  // Current player (whose turn it is based on game time)
  currentPlayer: PlayerType = "day";

  // The player type assigned to this client (day or night)
  // This is set from the URL parameter and doesn't change
  readonly myPlayerType: PlayerType | null;

  // Player states
  dayPlayer: Player;
  nightPlayer: Player;

  // UI state (client-only, not persisted)
  selectedTile: Tile | undefined | null = undefined;

  // API client for server communication
  private readonly client: GameClient = new GameClient();

  // Track previous time for transition detection
  private previousWasDay: boolean = true;

  // Game over state
  gameOver: boolean = false;
  winner: PlayerType | null = null;

  constructor(canvas: Canvas, myPlayerType: PlayerType | null = null) {
    this.canvas = canvas;
    this.myPlayerType = myPlayerType;
    this.dayPlayer = new Player({ type: "day" });
    this.nightPlayer = new Player({ type: "night" });
    this.dialog = new Dialog();
  }

  /**
   * Get the player instance for this client
   * Returns the player assigned to this client (myPlayerType), not the current turn player
   */
  get player(): Player {
    if (this.myPlayerType === "day") return this.dayPlayer;
    if (this.myPlayerType === "night") return this.nightPlayer;
    // Fallback to current player if no assignment (spectator mode)
    return this.currentPlayer === "day" ? this.dayPlayer : this.nightPlayer;
  }

  /**
   * Check if it's this client's turn to play
   */
  get isMyTurn(): boolean {
    if (this.myPlayerType === null) return false;
    return this.currentPlayer === this.myPlayerType;
  }

  /**
   * Apply parsed game state to the board and detect time transitions
   */
  private applyGameState(game: ServerGameState): void {
    const parsed = parseGameState(game);

    this.id = parsed.id;
    this.clock = parsed.clock;
    this.currentPlayer = parsed.currentPlayer;
    this.dayPlayer = parsed.dayPlayer;
    this.nightPlayer = parsed.nightPlayer;
    this.tiles = parsed.tiles;
    this.gameOver = parsed.gameOver;
    this.winner = parsed.winner;

    // Detect time transitions for dialogs
    const wasDay = this.previousWasDay;
    const isNowDay = this.clock.isDay();
    if (wasDay && !isNowDay) {
      this.dialog.open({ title: "Dusk", content: "The sun is setting" });
    } else if (!wasDay && isNowDay) {
      this.dialog.open({ title: "Dawn", content: "The sun is rising" });
    }
    this.previousWasDay = isNowDay;
  }

  /**
   * Parse game state from server response
   */
  parse(game: ServerGameState): void {
    this.applyGameState(game);

    console.log("Game state parsed", {
      id: this.id,
      currentPlayer: this.currentPlayer,
      myPlayerType: this.myPlayerType,
      isMyTurn: this.isMyTurn,
      clock: this.clock.toString(),
      gameOver: this.gameOver,
      winner: this.winner,
    });

    // Handle game over
    if (this.gameOver) {
      this.handleGameOver();
      return;
    }

    // Request notification permission for turn alerts
    Notifications.requestPermission();

    // Start polling for updates if not already polling
    this.startPolling();
  }

  /**
   * Start polling for game state updates
   * This allows us to see when the other player makes a move
   */
  private startPolling(): void {
    this.client.startPolling(this.id, (game) => this.parseQuiet(game));
  }

  /**
   * Parse game state without logging (for polling updates)
   */
  private parseQuiet(game: ServerGameState): void {
    // Store old state to detect changes
    const wasMyTurn = this.isMyTurn;
    const wasGameOver = this.gameOver;

    this.applyGameState(game);

    // Handle game over (only show dialog once)
    if (this.gameOver && !wasGameOver) {
      this.handleGameOver();
      return;
    }

    // Notify if turn changed
    const isNowMyTurn = this.isMyTurn;
    if (!wasMyTurn && isNowMyTurn && this.myPlayerType !== null) {
      console.log("It's your turn!");
      Notifications.notifyTurnChange(this.myPlayerType);
      this.dialog.open({
        title: "Your Turn!",
        content: `It's ${this.myPlayerType} player's turn`,
      });
    }
  }

  /**
   * Handle game over state
   */
  private handleGameOver(): void {
    // Stop polling
    this.stopPolling();

    // Determine if we won or lost
    const isWinner = this.winner === this.myPlayerType;
    const winnerName = this.winner === "day" ? "Day" : "Night";

    if (this.myPlayerType !== null) {
      if (isWinner) {
        this.dialog.open({
          title: "Victory!",
          content: `Congratulations! The ${winnerName} Alliance has won!`,
        });
        Notifications.showNotification("Victory!", `You have won the battle!`);
      } else {
        this.dialog.open({
          title: "Defeat",
          content: `The ${winnerName} Alliance has won. Better luck next time!`,
        });
        Notifications.showNotification(
          "Game Over",
          `The ${winnerName} Alliance has won.`,
        );
      }
    } else {
      // Spectator
      this.dialog.open({
        title: "Game Over",
        content: `The ${winnerName} Alliance has won!`,
      });
    }

    Notifications.playSound();
  }

  /**
   * Stop polling for game state updates
   */
  private stopPolling(): void {
    this.client.stopPolling();
  }

  /**
   * Render the game state - this is called every frame
   */
  render(): void {
    const canvas = this.canvas;
    canvas.ctx.save();

    // Calculate exploration based on current player's view
    this.calculateExploration();

    // Render all tiles
    this.tiles.forEach((tile: Tile) => {
      tile.render(canvas.ctx);
    });

    // Render selected tile highlight and valid moves/attacks
    if (this.selectedTile !== undefined && this.selectedTile !== null) {
      // Show view range
      this.selectedTile.renderArea(canvas.ctx, this.tiles);
      // Show valid moves (green) and lootable tiles (yellow)
      this.selectedTile.renderValidMoves(canvas.ctx, this.tiles);
      // Show attackable enemies (red)
      this.selectedTile.renderValidAttacks(
        canvas.ctx,
        this.tiles,
        this.myPlayerType,
      );
      // Selection outline
      Hexagon.render(
        canvas.ctx,
        this.selectedTile.x,
        this.selectedTile.y,
        "#00ffff",
      );
    }

    // Render hovered tile
    const hoveredTile = this.findTile(canvas.mousePosition);
    if (hoveredTile !== undefined) {
      hoveredTile.renderHovered(canvas.ctx);
    }

    canvas.ctx.restore();

    // Render UI
    renderResourcesInDOM(this.player.resources);
    this.clock.render(this.currentPlayer, this.myPlayerType ?? undefined);
  }

  /**
   * Calculate which tiles are explored based on this client's player's units and buildings
   * Uses myPlayerType (not currentPlayer) so each client sees their own fog of war
   */
  private calculateExploration(): void {
    // If no player assigned (spectator), show everything
    const viewingPlayer = this.myPlayerType ?? this.currentPlayer;

    // First, unexplore all tiles
    this.tiles.forEach((tile) => (tile.explored = false));

    // Then explore tiles visible to our player
    this.tiles.forEach((tile) => {
      // Check if tile has a piece owned by our player
      if (tile.piece?.owner?.type === viewingPlayer) {
        tile.explored = true;
        const viewRange = Math.max(
          tile.building?.viewRange ?? 0,
          tile.piece?.viewRange ?? 0,
        );
        const tilesInRange = tile.getTilesInRange(this.tiles, viewRange);
        tilesInRange.forEach((rangeTile) => (rangeTile.explored = true));
      }

      // Check if tile has a building owned by our player
      if (tile.building?.owner?.type === viewingPlayer) {
        tile.explored = true;
      }
    });
  }

  /**
   * Find a tile by pixel position or row/column
   */
  findTile(
    pos: { x: number; y: number } | { row: number; column: number },
  ): Tile | undefined {
    if ("x" in pos && "y" in pos) {
      return this.tiles.find((tile) => tile.isMouseOver(pos.x, pos.y));
    }
    return this.tiles.find(
      (tile) => tile.row === pos.row && tile.column === pos.column,
    );
  }

  /**
   * Convert pixel coordinates to tile position
   */
  private pixelToTilePosition(
    pos: Coordinate,
  ): { row: number; column: number } | null {
    const tile = this.findTile(pos);
    if (tile === undefined) return null;
    return { row: tile.row, column: tile.column };
  }

  /**
   * Get the selected tile position (if any)
   */
  private getSelectedPosition(): { row: number; column: number } | undefined {
    if (this.selectedTile === undefined || this.selectedTile === null)
      return undefined;
    return { row: this.selectedTile.row, column: this.selectedTile.column };
  }

  // ============================================
  // API COMMUNICATION
  // ============================================

  /**
   * Send an action to the server and update local state with response
   */
  private async sendAction(action: GameAction): Promise<boolean> {
    if (this.myPlayerType === null) {
      console.warn("No player assigned - cannot send actions");
      return false;
    }

    if (!this.isMyTurn) {
      console.warn("Not your turn - action blocked");
      return false;
    }

    const { success, response } = await this.client.sendAction(
      this.id,
      action,
    );

    if (response === undefined) {
      return false;
    }

    if (response.result.success) {
      this.parseQuiet(response.game);
      if (response.result.message !== undefined) {
        console.log("Action result:", response.result.message);
      }
    } else {
      console.warn("Action failed:", response.result.error);
      if (response.game !== undefined) {
        this.parseQuiet(response.game);
      }
    }

    return success;
  }

  // ============================================
  // USER INPUT HANDLERS
  // ============================================

  /**
   * Handle click on the canvas
   */
  async click({ x, y }: Coordinate): Promise<void> {
    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    const clickedTile = this.findTile(tilePosition);
    if (clickedTile === undefined) return;

    // Use myPlayerType for ownership checks (our player's pieces/buildings)
    const myPlayer = this.myPlayerType;

    // If clicking on a tile with our piece, just select it locally
    if (myPlayer !== null && clickedTile.piece?.owner?.type === myPlayer) {
      this.selectedTile = clickedTile;
      return;
    }

    // If clicking on a tile with our building (and no piece), select it
    if (
      myPlayer !== null &&
      clickedTile.building?.owner?.type === myPlayer &&
      clickedTile.piece === undefined
    ) {
      this.selectedTile = clickedTile;
      return;
    }

    // If we have a selected tile, try to perform an action
    if (
      this.selectedTile !== undefined &&
      this.selectedTile !== null &&
      myPlayer !== null
    ) {
      const previousSelectedPosition = {
        row: this.selectedTile.row,
        column: this.selectedTile.column,
      };
      const isNeighborClick = clickedTile.isNeighborTo(
        previousSelectedPosition,
      );

      const success = await this.sendAction({
        type: "click",
        player: myPlayer,
        position: tilePosition,
        selectedPosition: this.getSelectedPosition(),
      });

      if (success) {
        const newTile = this.findTile(tilePosition);
        if (newTile?.piece?.owner?.type === myPlayer) {
          // Piece moved to clicked tile - select it there
          this.selectedTile = newTile;
        } else if (isNeighborClick) {
          // Clicked a neighbor (e.g. looting) - keep selection on original tile
          // Re-fetch the tile using row/column (not pixel coords)
          const updatedOriginalTile = this.findTile(previousSelectedPosition);
          if (updatedOriginalTile?.piece?.owner?.type === myPlayer) {
            this.selectedTile = updatedOriginalTile;
          } else {
            this.selectedTile = undefined;
          }
        } else {
          // Non-neighbor click - clear selection
          this.selectedTile = undefined;
        }
      }
    } else {
      // No selection, just clicking on empty tile
      this.selectedTile = clickedTile;
    }
  }

  /**
   * Build a structure at the given position
   */
  async build(
    buildingType: BuildingType,
    { x, y }: Coordinate,
  ): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "build",
      player: this.myPlayerType,
      buildingType,
      position: tilePosition,
      selectedPosition: this.getSelectedPosition(),
    });
  }

  /**
   * Build a farm at the given position
   */
  async buildFarm({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "build",
      player: this.myPlayerType,
      buildingType: BuildingType.farm,
      position: tilePosition,
      selectedPosition: this.getSelectedPosition(),
    });
  }

  /**
   * Create a peasant at the given position
   */
  async createPeasant({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "createPeasant",
      player: this.myPlayerType,
      position: tilePosition,
    });
  }

  /**
   * Upgrade a unit at the given position
   */
  async upgrade({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "upgrade",
      player: this.myPlayerType,
      position: tilePosition,
    });
  }

  /**
   * Upgrade a unit to archer at the given position
   */
  async upgradeArcher({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "upgrade",
      player: this.myPlayerType,
      position: tilePosition,
      targetType: PieceType.archer,
    });
  }

  /**
   * Attack a target at the given position
   */
  async attack({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    const selectedPosition = this.getSelectedPosition();
    if (selectedPosition === undefined) {
      console.warn("No unit selected to attack with");
      return;
    }

    await this.sendAction({
      type: "attack",
      player: this.myPlayerType,
      position: tilePosition,
      selectedPosition,
    });
  }
}

const renderResourcesInDOM = (resourceMap: ResourceMap): void => {
  const woodElement = document.getElementById("wood");
  const stoneElement = document.getElementById("stone");
  const goldElement = document.getElementById("gold");
  const foodElement = document.getElementById("food");

  if (woodElement !== null) {
    woodElement.textContent = resourceMap.wood.toString();
  }
  if (stoneElement !== null) {
    stoneElement.textContent = resourceMap.stone.toString();
  }
  if (goldElement !== null) {
    goldElement.textContent = resourceMap.gold.toString();
  }
  if (foodElement !== null) {
    foodElement.textContent = resourceMap.food.toString();
  }
};
