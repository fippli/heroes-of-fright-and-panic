import { supabase } from "./supabase";

/**
 * A faction is a player-owned reskin of one of the two rule-sets. The engine
 * still plays the four piece tiers; a faction names them and gives them art.
 */

export type FactionType = "day" | "night";

export type FactionPiece = {
  readonly name?: string;
  readonly imagePath?: string;
};

/** Keyed by engine PieceKind ("peasant" | "king" | "priest" | "archAngel") */
export type FactionPieces = Readonly<Record<string, FactionPiece>>;

/** Keyed by resource ("faith", ...): the faction's own word for the mechanic */
export type FactionResources = Readonly<Record<string, { readonly name?: string }>>;

export type Faction = {
  readonly id: string;
  readonly ownerEmail: string;
  readonly name: string;
  readonly type: FactionType;
  readonly pieces: FactionPieces;
  readonly resources: FactionResources;
  readonly updatedAt: string;
};

/** Resources whose name is faction flavor (same mechanic, your word for it) */
export const FACTION_RESOURCES: readonly { readonly key: string; readonly label: string; readonly hint: string }[] = [
  { key: "faith", label: "Faith", hint: 'e.g. "sin" for devils, "mana" for magicians' },
];

/** The piece tiers a faction can customize, with the classic default names */
export const FACTION_TIERS: readonly {
  readonly kind: string;
  readonly tier: number;
  readonly dayDefault: string;
  readonly nightDefault: string;
}[] = [
  { kind: "peasant", tier: 1, dayDefault: "Peasant", nightDefault: "Peasant" },
  { kind: "king", tier: 2, dayDefault: "King", nightDefault: "King" },
  { kind: "priest", tier: 3, dayDefault: "Priest", nightDefault: "Priest" },
  { kind: "archAngel", tier: 4, dayDefault: "Archangel", nightDefault: "Archangel" },
];

export const defaultTierName = (kind: string, type: FactionType): string => {
  const tier = FACTION_TIERS.find((entry) => entry.kind === kind);
  if (tier === undefined) return kind;
  return type === "day" ? tier.dayDefault : tier.nightDefault;
};

const STORAGE_BUCKET = "faction-assets";

const mapRow = (row: {
  id: string;
  owner_email: string;
  name: string;
  type: string;
  pieces: FactionPieces | null;
  resources: FactionResources | null;
  updated_at: string;
}): Faction => ({
  id: row.id,
  ownerEmail: row.owner_email,
  name: row.name,
  type: row.type === "night" ? "night" : "day",
  pieces: row.pieces ?? {},
  resources: row.resources ?? {},
  updatedAt: row.updated_at,
});

const SELECT = "id, owner_email, name, type, pieces, resources, updated_at";

export const factionsApi = {
  async listOwn(): Promise<readonly Faction[]> {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (email === undefined) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("factions")
      .select(SELECT)
      .eq("owner_email", email)
      .order("updated_at", { ascending: false });

    if (error !== null) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  },

  async byIds(ids: readonly string[]): Promise<readonly Faction[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("factions")
      .select(SELECT)
      .in("id", ids);

    if (error !== null) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  },

  async create(name: string, type: FactionType): Promise<Faction> {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (email === undefined) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("factions")
      .insert({ owner_email: email, name, type })
      .select(SELECT)
      .single();

    if (error !== null) throw new Error(error.message);
    return mapRow(data);
  },

  async update(
    factionId: string,
    changes: {
      readonly name?: string;
      readonly pieces?: FactionPieces;
      readonly resources?: FactionResources;
    },
  ): Promise<Faction> {
    const { data, error } = await supabase
      .from("factions")
      .update(changes)
      .eq("id", factionId)
      .select(SELECT)
      .single();

    if (error !== null) throw new Error(error.message);
    return mapRow(data);
  },

  async delete(factionId: string): Promise<void> {
    const { error } = await supabase.from("factions").delete().eq("id", factionId);
    if (error !== null) throw new Error(error.message);
  },

  /** Upload a tier image; returns the storage path to save on the faction */
  async uploadPieceImage(factionId: string, kind: string, file: File): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userId === undefined) throw new Error("Not authenticated");

    const extension = file.name.split(".").at(-1) ?? "png";
    const storagePath = `${userId}/${factionId}/${kind}.${extension}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { upsert: true });

    if (error !== null) throw new Error(error.message);
    return storagePath;
  },

  getPublicUrl(storagePath: string, version?: string): string {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    // Uploads overwrite the same path; a version query defeats the CDN cache
    return version !== undefined
      ? `${data.publicUrl}?v=${encodeURIComponent(version)}`
      : data.publicUrl;
  },
};
