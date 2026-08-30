export type AssetCategory = "piece" | "building" | "landscape";

type AssetSlot = {
  readonly category: AssetCategory;
  readonly key: string;
  readonly label: string;
};

export const ASSET_SLOTS: readonly AssetSlot[] = [
  // Pieces
  { category: "piece", key: "peasant_day", label: "Peasant (Day)" },
  { category: "piece", key: "peasant_night", label: "Peasant (Night)" },
  { category: "piece", key: "king_day", label: "King (Day)" },
  { category: "piece", key: "king_night", label: "King (Night)" },
  { category: "piece", key: "priest_day", label: "Priest (Day)" },
  { category: "piece", key: "priest_night", label: "Priest (Night)" },
  { category: "piece", key: "archAngel_day", label: "Arch Angel (Day)" },
  { category: "piece", key: "archAngel_night", label: "Arch Angel (Night)" },

  // Equipment
  { category: "piece", key: "sword", label: "Sword" },
  { category: "piece", key: "shield", label: "Shield" },
  { category: "piece", key: "bow", label: "Bow" },

  // Steeds
  { category: "piece", key: "horse", label: "Horse" },
  { category: "piece", key: "boat", label: "Boat" },

  // Buildings
  { category: "building", key: "house_day", label: "House (Day)" },
  { category: "building", key: "house_night", label: "House (Night)" },
  { category: "building", key: "castle_day", label: "Castle (Day)" },
  { category: "building", key: "castle_night", label: "Castle (Night)" },
  { category: "building", key: "tower_day", label: "Tower (Day)" },
  { category: "building", key: "tower_night", label: "Tower (Night)" },
  { category: "building", key: "wall_day", label: "Wall (Day)" },
  { category: "building", key: "wall_night", label: "Wall (Night)" },
  { category: "building", key: "church_day", label: "Church (Day)" },
  { category: "building", key: "church_night", label: "Church (Night)" },

  // Landscape
  { category: "landscape", key: "unexplored", label: "Unexplored" },
  { category: "landscape", key: "grass", label: "Grass" },
  { category: "landscape", key: "farm", label: "Farm" },
  { category: "landscape", key: "tree", label: "Tree" },
  { category: "landscape", key: "sand", label: "Sand" },
  { category: "landscape", key: "water", label: "Water" },
  { category: "landscape", key: "mountain", label: "Mountain" },
] as const;

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  "piece",
  "building",
  "landscape",
] as const;

export const getSlotsByCategory = (
  category: AssetCategory,
): readonly AssetSlot[] =>
  ASSET_SLOTS.filter((slot) => slot.category === category);

export type Faction = "day" | "night" | "items" | "landscape";

export const FACTIONS: readonly { readonly id: Faction; readonly label: string }[] = [
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
  { id: "items", label: "Items" },
  { id: "landscape", label: "Landscape" },
];

/** Equipment and steeds: faction-neutral piece overlays drawn on top of / under a piece */
const isItemSlot = (slot: AssetSlot): boolean =>
  slot.category === "piece" && !/_(day|night)$/.test(slot.key);

export const getSlotsForFaction = (
  faction: Faction,
  category: AssetCategory,
): readonly AssetSlot[] =>
  ASSET_SLOTS.filter((slot) => {
    if (faction === "landscape") {
      return slot.category === "landscape";
    }
    if (faction === "items") {
      return isItemSlot(slot);
    }
    return slot.category === category && slot.key.endsWith(`_${faction}`);
  });
