/**
 * Simple default theme — colored hexagons for terrain, chess unicode
 * characters for pieces, and simple shapes for buildings.
 *
 * Uses inline SVG data URLs so no image files are needed.
 * Plugs into the existing ImageAssets/GameImage pipeline.
 */

import { GameImage } from "../core/GameImage";
import { Hexagon } from "../core/Hexagon";
import { LandscapeType } from "../core/Landscape";
import { PieceKind } from "../core/Piece";
import { BuildingType } from "../core/Building";
import type { Player } from "@shared/player";

const WIDTH = Hexagon.width;
const HEIGHT = Hexagon.height;

// ============================================
// SVG HELPERS
// ============================================

const colorSvg = (color: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${color}"/>` +
    `</svg>`
  )}`;

const textSvg = (
  text: string,
  color: string,
  backgroundColor: string,
  fontSize: number = 28,
): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${backgroundColor}"/>` +
    `<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" ` +
    `font-size="${fontSize}" fill="${color}">${text}</text>` +
    `</svg>`
  )}`;

const buildingSvg = (
  symbol: string,
  ownerColor: string,
  backgroundColor: string,
): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${backgroundColor}"/>` +
    `<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" ` +
    `font-size="24" fill="${ownerColor}">${symbol}</text>` +
    `</svg>`
  )}`;

const createImage = (src: string): GameImage =>
  new GameImage({ src, width: WIDTH, height: HEIGHT });

// ============================================
// LANDSCAPE COLORS
// ============================================

const LANDSCAPE_COLORS: Record<string, string> = {
  [LandscapeType.grass]: "#5a8a3c",
  [LandscapeType.tree]: "#2d5a1e",
  [LandscapeType.mountain]: "#8a7a6a",
  [LandscapeType.water]: "#2a6a9a",
  [LandscapeType.sand]: "#c4a95a",
  [LandscapeType.farm]: "#7a9a3a",
  [LandscapeType.unexplored]: "#222222",
};

const landscapeImages = new Map<string, GameImage>(
  Object.entries(LANDSCAPE_COLORS).map(([landscapeType, color]) => [
    landscapeType,
    createImage(colorSvg(color)),
  ]),
);

// ============================================
// PIECE SYMBOLS (chess unicode)
// ============================================

const PIECE_SYMBOLS: Record<string, string> = {
  [PieceKind.peasant]: "♟",
  [PieceKind.king]: "♚",
  [PieceKind.priest]: "♝",
  [PieceKind.archAngel]: "♛",
};

const DAY_COLOR = "#ffd700";
const NIGHT_COLOR = "#b090ff";

// ============================================
// BUILDING SYMBOLS
// ============================================

const BUILDING_SYMBOLS: Record<string, string> = {
  [BuildingType.house]: "⌂",
  [BuildingType.tower]: "♜",
  [BuildingType.castle]: "♖",
  [BuildingType.wall]: "▬",
  [BuildingType.church]: "✝",
};

// ============================================
// PUBLIC API
// ============================================

export const simpleLandscapeImage = (landscapeType: LandscapeType): GameImage =>
  landscapeImages.get(landscapeType) ?? createImage(colorSvg("#333333"));

export const simplePieceImage = (player: Player, kind: PieceKind): GameImage => {
  const symbol = PIECE_SYMBOLS[kind] ?? "?";
  const color = player.type === "day" ? DAY_COLOR : NIGHT_COLOR;
  // Transparent background — piece renders on top of landscape
  return createImage(textSvg(symbol, color, "transparent", 30));
};

export const simpleBuildingImage = (player: Player, buildingType: BuildingType): GameImage => {
  const symbol = BUILDING_SYMBOLS[buildingType] ?? "?";
  const color = player.type === "day" ? DAY_COLOR : NIGHT_COLOR;
  return createImage(buildingSvg(symbol, color, "transparent"));
};

/**
 * ImageAssets-compatible object using the simple color theme.
 * Drop-in replacement for ImageAssets anywhere that accepts
 * { pieceImage, buildingImage, landscapeImage }.
 */
export const simpleImageAssets = {
  pieceImage: simplePieceImage,
  buildingImage: simpleBuildingImage,
  landscapeImage: simpleLandscapeImage,
};
