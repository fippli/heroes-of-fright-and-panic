import type { Coordinate } from "../types/coordinate";
import { Hexagon } from "./Hexagon";

export type Bounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

type Viewport = { readonly width: number; readonly height: number };

const clampAxis = (
  value: number,
  contentMin: number,
  contentMax: number,
  viewportSize: number,
  padding: number,
): number => {
  // Content's far edge may not move further inward than the viewport's far edge
  const low = viewportSize - contentMax - padding;
  // Content's near edge may not move further inward than the viewport's near edge
  const high = -contentMin + padding;
  if (low > high) {
    // Content is smaller than the viewport: keep it centered
    return (low + high) / 2;
  }
  return Math.min(high, Math.max(low, value));
};

/**
 * Clamp a translation so the map always fills the viewport (or is centered
 * when it is smaller than the viewport). Prevents scrolling off into the void.
 */
export const clampTranslation = (
  translation: Coordinate,
  bounds: Bounds,
  viewport: Viewport,
  padding: number = 0,
): Coordinate => ({
  x: clampAxis(translation.x, bounds.minX, bounds.maxX, viewport.width, padding),
  y: clampAxis(translation.y, bounds.minY, bounds.maxY, viewport.height, padding),
});

/** Translation that puts the given world point in the middle of the viewport */
export const translationCenteredOn = (
  point: Coordinate,
  viewport: Viewport,
): Coordinate => ({
  x: viewport.width / 2 - point.x,
  y: viewport.height / 2 - point.y,
});

/**
 * How far to scroll this frame given the mouse's screen position. Returns
 * a zero vector when the mouse is not near an edge (or not over the canvas).
 * Speed ramps up the closer the mouse is to the edge.
 */
export const edgeScrollDelta = (
  mouse: Coordinate | null,
  viewport: Viewport,
  margin: number,
  maxSpeed: number,
): Coordinate => {
  if (mouse === null) {
    return { x: 0, y: 0 };
  }
  const axis = (position: number, size: number): number => {
    if (position < 0 || position > size) {
      return 0;
    }
    if (position < margin) {
      // Near the near edge: move content in the positive direction
      return maxSpeed * ((margin - position) / margin);
    }
    if (position > size - margin) {
      return -maxSpeed * ((position - (size - margin)) / margin);
    }
    return 0;
  };
  return {
    x: axis(mouse.x, viewport.width),
    y: axis(mouse.y, viewport.height),
  };
};

/** World-space extent of a set of tiles, including the hexes' own size */
export const boundsOfTiles = (
  tiles: ReadonlyArray<{ readonly x: number; readonly y: number }>,
): Bounds => {
  const xs = tiles.map((tile) => tile.x);
  const ys = tiles.map((tile) => tile.y);
  return {
    minX: Math.min(...xs) - Hexagon.width / 2,
    minY: Math.min(...ys) - Hexagon.height / 2,
    maxX: Math.max(...xs) + Hexagon.width / 2,
    maxY: Math.max(...ys) + Hexagon.height / 2,
  };
};

/** Point to center the view on: the given player's king, else their first piece, else the map center */
export const focusPoint = <
  T extends {
    readonly x: number;
    readonly y: number;
    readonly piece?: { readonly kind: string; readonly owner: { readonly type: string } };
  },
>(
  tiles: ReadonlyArray<T>,
  playerType: string | null,
  bounds: Bounds,
): Coordinate => {
  const mine = tiles.filter((tile) => tile.piece?.owner.type === playerType);
  const focus = mine.find((tile) => tile.piece?.kind === "king") ?? mine[0];
  if (focus !== undefined) {
    return { x: focus.x, y: focus.y };
  }
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

/** Serialize a view center for the `view` URL query param */
export const formatViewParam = (center: Coordinate): string =>
  `${Math.round(center.x)},${Math.round(center.y)}`;

/** Parse the `view` URL query param; null when absent or malformed */
export const parseViewParam = (raw: string | null): Coordinate | null => {
  if (raw === null) {
    return null;
  }
  const parts = raw.split(",");
  if (parts.length !== 2) {
    return null;
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
};
