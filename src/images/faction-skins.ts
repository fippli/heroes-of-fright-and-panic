import { GameImage } from "../core/GameImage";
import { Hexagon } from "../core/Hexagon";
import { factionsApi, type Faction } from "../lib/factions";
import type { PieceKind } from "@shared/piece";
import type { FactionSkin, FactionSkins } from "./index";

const skinOf = (faction: Faction): FactionSkin => {
  const names: Partial<Record<PieceKind, string>> = {};
  const images: Partial<Record<PieceKind, GameImage>> = {};
  Object.entries(faction.pieces).forEach(([kind, piece]) => {
    const key = kind as PieceKind;
    if (piece.name !== undefined && piece.name !== "") names[key] = piece.name;
    if (piece.imagePath !== undefined) {
      images[key] = new GameImage({
        src: factionsApi.getPublicUrl(piece.imagePath, faction.updatedAt),
        width: Hexagon.height,
        height: Hexagon.height,
      });
    }
  });
  const resourceNames: Record<string, string> = {};
  Object.entries(faction.resources).forEach(([resource, entry]) => {
    if (entry.name !== undefined && entry.name !== "") resourceNames[resource] = entry.name;
  });
  return { names, images, resourceNames };
};

/** Resolve the game's chosen faction ids into per-side skins */
export const loadFactionSkins = async (
  dayFactionId: string | null,
  nightFactionId: string | null,
): Promise<FactionSkins> => {
  const ids = [dayFactionId, nightFactionId].filter(
    (id): id is string => id !== null,
  );
  if (ids.length === 0) return {};
  const factions = await factionsApi.byIds(ids);
  const byId = new Map(factions.map((faction) => [faction.id, faction]));
  const day = dayFactionId !== null ? byId.get(dayFactionId) : undefined;
  const night = nightFactionId !== null ? byId.get(nightFactionId) : undefined;
  return {
    ...(day !== undefined ? { day: skinOf(day) } : {}),
    ...(night !== undefined ? { night: skinOf(night) } : {}),
  };
};
