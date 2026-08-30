import type { Canvas } from "../canvas";
import { type ImageAssets, defaultImageAssets } from "../images";
import type { Coordinate } from "../types/coordinate";
import { BuildingType } from "./Building";
import { Clock } from "./Clock";
import { Dialog } from "./Dialog";
import { GameClient } from "./GameClient";
import { parseGameState } from "./GameParser";
import type { GameAction, PlayerType, ServerGameState } from "./GameTypes";
import { Hexagon } from "./Hexagon";
import { Notifications } from "./Notifications";
import { EquipmentType } from "@shared/equipment";
import { SteedType } from "@shared/steed";
import { ResearchType } from "@shared/research";
import { amplifiedView } from "@shared/piece";
import { createPlayer, type Player } from "@shared/player";
import type { TilePosition } from "@shared/map/tile";
import { renderResourcesInDOM } from "./render-resources";
import { Tile } from "./Tile";
import { LandscapeType } from "./Landscape";
import { boundsOfTiles, focusPoint } from "./viewport";
import { predictAction } from "./predict";
import type { GameUiState } from "./ui-state";

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

  // Whether the view has been positioned on the player's pieces yet
  private viewInitialized: boolean = false;

  // Last state confirmed by the server; the base for optimistic predictions
  // and what we fall back to when a prediction is not confirmed.
  private lastServerState: ServerGameState | null = null;

  // Build mode: the building type waiting for a tile click
  pendingBuild: BuildingType | null = null;

  // Sidebar subscribers, notified with a fresh snapshot on every change
  private readonly listeners = new Set<(ui: GameUiState) => void>();

  // Game over state
  gameOver: boolean = false;
  winner: PlayerType | null = null;

  // Image assets (with optional theme override)
  imageAssets: ImageAssets;

  constructor(
    canvas: Canvas,
    myPlayerType: PlayerType | null = null,
    imageAssets: ImageAssets = defaultImageAssets,
  ) {
    this.canvas = canvas;
    this.myPlayerType = myPlayerType;
    this.dayPlayer = createPlayer({ type: "day" });
    this.nightPlayer = createPlayer({ type: "night" });
    this.dialog = new Dialog();
    this.imageAssets = imageAssets;
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

  /** Subscribe to UI snapshots; returns an unsubscribe function */
  subscribe(listener: (ui: GameUiState) => void): () => void {
    this.listeners.add(listener);
    listener(this.uiState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const ui = this.uiState();
    this.listeners.forEach((listener) => listener(ui));
  }

  uiState(): GameUiState {
    const selected = this.selectedTile ?? null;
    const mine = (owner: { type: PlayerType } | undefined): boolean =>
      owner !== undefined && owner.type === this.myPlayerType;
    return {
      isPlayer: this.myPlayerType !== null,
      isMyTurn: this.isMyTurn,
      resources: this.player.resources,
      pendingBuild: this.pendingBuild,
      selected:
        selected === null
          ? null
          : {
              row: selected.row,
              column: selected.column,
              building: mine(selected.building?.owner) ? (selected.building?.type ?? null) : null,
              piece: mine(selected.piece?.owner) ? (selected.piece?.kind ?? null) : null,
            },
    };
  }

  /** Enter build mode for a building type (click a tile to place it); null or the same type cancels */
  setPendingBuild(buildingType: BuildingType | null): void {
    this.pendingBuild =
      buildingType === null || buildingType === this.pendingBuild ? null : buildingType;
    this.notify();
  }

  /** Escape: leave build mode and clear the selection */
  cancel(): void {
    this.pendingBuild = null;
    this.selectedTile = undefined;
    this.notify();
  }

  /** Tiles a building could go on right now: explored grass without a building */
  private buildableTiles(): Tile[] {
    return this.tiles.filter(
      (tile) =>
        tile.explored &&
        tile.landscape?.type === LandscapeType.grass &&
        tile.building === undefined,
    );
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

    if (!this.viewInitialized && this.tiles.length > 0) {
      this.initializeView();
    }

    // Detect time transitions for dialogs
    const wasDay = this.previousWasDay;
    const isNowDay = this.clock.isDay();
    if (wasDay && !isNowDay) {
      this.dialog.open({ title: "Dusk", content: "The sun is setting" });
    } else if (!wasDay && isNowDay) {
      this.dialog.open({ title: "Dawn", content: "The sun is rising" });
    }
    this.previousWasDay = isNowDay;
    this.notify();
  }

  /**
   * Constrain panning to the map and position the view: where the URL says
   * it was (survives a refresh), else centered on this player's king (or
   * first owned piece). Spectators default to the map center.
   */
  private initializeView(): void {
    this.viewInitialized = true;
    const bounds = boundsOfTiles(this.tiles);
    this.canvas.setContentBounds(bounds);
    if (!this.canvas.restoreViewFromUrl()) {
      this.canvas.centerOn(focusPoint(this.tiles, this.myPlayerType, bounds));
    }

    // A player with no pieces at all can only mean the game was stored in an
    // older data model the client no longer understands. Say so instead of
    // showing an unexplained blank map.
    const hasOwnPiece = this.tiles.some(
      (tile) => tile.piece?.owner?.type === this.myPlayerType,
    );
    if (this.myPlayerType !== null && !hasOwnPiece) {
      this.dialog.open({
        title: "Incompatible game",
        content:
          "This game was created with an older version and has no pieces the current game can read. Start a new game to play.",
      });
    }
  }

  /**
   * Parse game state from server response
   */
  parse(game: ServerGameState): void {
    this.lastServerState = game;
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

    this.lastServerState = game;
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
      tile.render(canvas.ctx, this.imageAssets);
    });

    // Build mode: outline every tile the building could go on
    if (this.pendingBuild !== null) {
      this.buildableTiles().forEach((tile) => {
        Hexagon.render(canvas.ctx, tile.x, tile.y, "#ffd54f66");
      });
    }

    // Render selected tile highlight and valid moves/attacks
    if (this.selectedTile !== undefined && this.selectedTile !== null) {
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
    // Spectator: show everything
    if (this.myPlayerType === null) {
      this.tiles.forEach((tile) => (tile.explored = true));
      return;
    }

    // First, unexplore all tiles
    this.tiles.forEach((tile) => (tile.explored = false));

    // Then explore tiles visible to our player
    this.tiles.forEach((tile) => {
      if (tile.piece?.owner?.type === this.myPlayerType) {
        tile.explored = true;
        // A piece's view is amplified by a friendly building it occupies.
        const buildingView =
          tile.building?.owner?.type === this.myPlayerType
            ? tile.building.viewRange
            : undefined;
        const viewRange = amplifiedView(
          tile.piece?.viewRange ?? 0,
          buildingView,
        );
        const tilesInRange = tile.getTilesInRange(this.tiles, viewRange);
        tilesInRange.forEach((rangeTile) => (rangeTile.explored = true));
      }

      // You always see your own building's tile (buildings emit no vision).
      if (tile.building?.owner?.type === this.myPlayerType) {
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

    // Optimistic update: run the same engine locally and render the outcome
    // right away. The server's response below always replaces it.
    const baseline = this.lastServerState;
    const predicted = baseline !== null ? predictAction(baseline, action) : null;
    if (predicted !== null) {
      this.applyGameState(predicted);
    }

    const { success, response } = await this.client.sendAction(this.id, action);

    if (response === undefined) {
      // Request failed outright: undo the prediction
      if (predicted !== null && baseline !== null) {
        this.applyGameState(baseline);
      }
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
      } else if (predicted !== null && baseline !== null) {
        this.applyGameState(baseline);
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

    // Build mode: the click places the pending building
    if (this.pendingBuild !== null && this.myPlayerType !== null) {
      const placed = await this.sendAction({
        type: "build",
        player: this.myPlayerType,
        buildingType: this.pendingBuild,
        position: tilePosition,
      });
      if (placed) {
        this.pendingBuild = null;
        this.selectedTile = this.findTile(tilePosition);
      }
      this.notify();
      return;
    }

    // Use myPlayerType for ownership checks (our player's pieces/buildings)
    const myPlayer = this.myPlayerType;

    // If clicking on a tile with our piece, just select it locally
    if (myPlayer !== null && clickedTile.piece?.owner?.type === myPlayer) {
      this.selectedTile = clickedTile;
      this.notify();
      return;
    }

    // If clicking on a tile with our building (and no piece), select it
    if (
      myPlayer !== null &&
      clickedTile.building?.owner?.type === myPlayer &&
      clickedTile.piece === undefined
    ) {
      this.selectedTile = clickedTile;
      this.notify();
      return;
    }

    // If we have a selected tile with our own piece, the click resolves to a
    // concrete engine action: attack an enemy, harvest adjacent terrain
    // (tree/rock), otherwise move.
    if (
      this.selectedTile !== undefined &&
      this.selectedTile !== null &&
      this.selectedTile.piece?.owner?.type === myPlayer &&
      myPlayer !== null
    ) {
      const from: TilePosition = {
        row: this.selectedTile.row,
        column: this.selectedTile.column,
      };

      const action: GameAction = ((): GameAction => {
        if (this.isEnemyTile(clickedTile, myPlayer)) {
          return {
            type: "attack",
            player: myPlayer,
            attackerPosition: from,
            targetPosition: tilePosition,
          };
        }
        if (
          clickedTile.landscape?.lootDrop !== undefined &&
          clickedTile.isNeighborTo(from)
        ) {
          return {
            type: "loot",
            player: myPlayer,
            piecePosition: from,
            targetPosition: tilePosition,
          };
        }
        return {
          type: "move",
          player: myPlayer,
          from,
          to: tilePosition,
        };
      })();

      const success = await this.sendAction(action);

      if (success) {
        // Re-select the acting piece wherever it now lives (it moves on a
        // successful move, stays put on an attack or harvest).
        const movedTile = this.findTile(tilePosition);
        const originalTile = this.findTile(from);
        if (movedTile?.piece?.owner?.type === myPlayer) {
          this.selectedTile = movedTile;
        } else if (originalTile?.piece?.owner?.type === myPlayer) {
          this.selectedTile = originalTile;
        } else {
          this.selectedTile = undefined;
        }
      }
      this.notify();
    } else {
      // No actionable selection - just (de)select the clicked tile
      this.selectedTile = clickedTile;
      this.notify();
    }
  }

  // ============================================
  // MENU ACTIONS (take a tile position, not a mouse position)
  // ============================================

  async buildAt(buildingType: BuildingType, position: TilePosition): Promise<boolean> {
    if (this.myPlayerType === null) return false;
    return this.sendAction({ type: "build", player: this.myPlayerType, buildingType, position });
  }

  async spawnPeasantAt(position: TilePosition): Promise<boolean> {
    if (this.myPlayerType === null) return false;
    return this.sendAction({ type: "spawnPeasant", player: this.myPlayerType, position });
  }

  async trainPriestAt(churchPosition: TilePosition): Promise<boolean> {
    if (this.myPlayerType === null) return false;
    return this.sendAction({ type: "trainPriest", player: this.myPlayerType, churchPosition });
  }

  async summonArchAngelAt(churchPosition: TilePosition): Promise<boolean> {
    if (this.myPlayerType === null) return false;
    return this.sendAction({ type: "summonArchAngel", player: this.myPlayerType, churchPosition });
  }

  async researchAt(researchType: ResearchType, castlePosition: TilePosition): Promise<boolean> {
    if (this.myPlayerType === null) return false;
    return this.sendAction({ type: "research", player: this.myPlayerType, researchType, castlePosition });
  }

  async craftEquipmentAt(equipmentType: EquipmentType, piecePosition: TilePosition): Promise<boolean> {
    if (this.myPlayerType === null) return false;
    return this.sendAction({ type: "craftEquipment", player: this.myPlayerType, equipmentType, piecePosition });
  }

  /**
   * Whether a tile holds an enemy piece or enemy building (a valid attack target)
   */
  private isEnemyTile(tile: Tile, myPlayer: PlayerType): boolean {
    const enemyPiece =
      tile.piece?.owner?.type !== undefined &&
      tile.piece.owner.type !== myPlayer;
    const enemyBuilding =
      tile.building?.owner?.type !== undefined &&
      tile.building.owner.type !== myPlayer;
    return enemyPiece || enemyBuilding;
  }

  /**
   * Build a structure at the given position
   */
  async build(buildingType: BuildingType, { x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "build",
      player: this.myPlayerType,
      buildingType,
      position: tilePosition,
    });
  }

  /**
   * Build a farm at the given position
   * Note: Farms are now auto-created when houses are built (adjacent grass → farm).
   * This method builds a house instead.
   */
  async buildFarm({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "build",
      player: this.myPlayerType,
      buildingType: BuildingType.house,
      position: tilePosition,
    });
  }

  /**
   * Spawn a peasant in the friendly house at the given position
   */
  async spawnPeasant({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "spawnPeasant",
      player: this.myPlayerType,
      position: tilePosition,
    });
  }

  /**
   * Equip the piece at the given position with a piece of equipment
   */
  async craftEquipment(
    equipmentType: EquipmentType,
    { x, y }: Coordinate,
  ): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "craftEquipment",
      player: this.myPlayerType,
      equipmentType,
      piecePosition: tilePosition,
    });
  }

  /**
   * Attack the target at the given position using the currently selected piece
   */
  async attack({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    const attackerPosition = this.getSelectedPosition();
    if (attackerPosition === undefined) {
      console.warn("No unit selected to attack with");
      return;
    }

    await this.sendAction({
      type: "attack",
      player: this.myPlayerType,
      attackerPosition,
      targetPosition: tilePosition,
    });
  }

  /**
   * Train a priest in the friendly church at the given position
   */
  async trainPriest({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "trainPriest",
      player: this.myPlayerType,
      churchPosition: tilePosition,
    });
  }

  /**
   * Summon an arch angel in the friendly church at the given position
   */
  async summonArchAngel({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "summonArchAngel",
      player: this.myPlayerType,
      churchPosition: tilePosition,
    });
  }

  /**
   * Research a technology at the friendly castle at the given position
   */
  async research(
    researchType: ResearchType,
    { x, y }: Coordinate,
  ): Promise<void> {
    if (this.myPlayerType === null) return;

    const tilePosition = this.pixelToTilePosition({ x, y });
    if (tilePosition === null) return;

    await this.sendAction({
      type: "research",
      player: this.myPlayerType,
      researchType,
      castlePosition: tilePosition,
    });
  }

  /**
   * Move the selected king into the tower at the given position to form a castle
   */
  async enterTower({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const towerPosition = this.pixelToTilePosition({ x, y });
    if (towerPosition === null) return;

    const kingPosition = this.getSelectedPosition();
    if (kingPosition === undefined) {
      console.warn("Select your king first");
      return;
    }

    await this.sendAction({
      type: "enterTower",
      player: this.myPlayerType,
      kingPosition,
      towerPosition,
    });
  }

  /**
   * Heal the friendly piece at the given position with the selected priest
   */
  async heal({ x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const targetPosition = this.pixelToTilePosition({ x, y });
    if (targetPosition === null) return;

    const priestPosition = this.getSelectedPosition();
    if (priestPosition === undefined) {
      console.warn("Select your priest first");
      return;
    }

    await this.sendAction({
      type: "heal",
      player: this.myPlayerType,
      priestPosition,
      targetPosition,
    });
  }

  /**
   * Place a steed on the given tile, bought from the selected house
   */
  async buySteed(steedType: SteedType, { x, y }: Coordinate): Promise<void> {
    if (this.myPlayerType === null) return;

    const targetPosition = this.pixelToTilePosition({ x, y });
    if (targetPosition === null) return;

    const housePosition = this.getSelectedPosition();
    if (housePosition === undefined) {
      console.warn("Select your house first");
      return;
    }

    await this.sendAction({
      type: "buySteed",
      player: this.myPlayerType,
      steedType,
      housePosition,
      targetPosition,
    });
  }
}
