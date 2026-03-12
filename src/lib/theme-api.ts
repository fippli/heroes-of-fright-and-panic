import { supabase } from "./supabase";

export type Theme = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
};

export type ThemeAsset = {
  readonly id: string;
  readonly themeId: string;
  readonly category: string;
  readonly assetKey: string;
  readonly storagePath: string;
};

const STORAGE_BUCKET = "theme-assets";

const mapThemeRow = (row: {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}): Theme => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const mapAssetRow = (row: {
  id: string;
  theme_id: string;
  category: string;
  asset_key: string;
  storage_path: string;
}): ThemeAsset => ({
  id: row.id,
  themeId: row.theme_id,
  category: row.category,
  assetKey: row.asset_key,
  storagePath: row.storage_path,
});

export const themesApi = {
  async getAll(): Promise<readonly Theme[]> {
    const { data, error } = await supabase
      .from("themes")
      .select("id, name, description, created_by, created_at")
      .order("created_at", { ascending: false });

    if (error !== null) {
      throw new Error(error.message);
    }

    return (data ?? []).map(mapThemeRow);
  },

  async create(params: {
    readonly name: string;
    readonly description: string;
  }): Promise<Theme> {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user === null || userData.user.email === undefined) {
      throw new Error("Not authenticated");
    }

    const { data, error } = await supabase
      .from("themes")
      .insert({
        name: params.name,
        description: params.description,
        created_by: userData.user.email,
      })
      .select("id, name, description, created_by, created_at")
      .single();

    if (error !== null) {
      throw new Error(error.message);
    }

    return mapThemeRow(data);
  },

  async delete(themeId: string): Promise<void> {
    // First get all assets to clean up storage
    const { data: assets } = await supabase
      .from("theme_assets")
      .select("storage_path")
      .eq("theme_id", themeId);

    // Remove storage files
    if (assets !== null && assets.length !== 0) {
      const paths = assets.map((asset) => asset.storage_path);
      await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    }

    // Delete the theme (cascade deletes theme_assets rows)
    const { error } = await supabase
      .from("themes")
      .delete()
      .eq("id", themeId);

    if (error !== null) {
      throw new Error(error.message);
    }
  },

  async getAssets(themeId: string): Promise<readonly ThemeAsset[]> {
    const { data, error } = await supabase
      .from("theme_assets")
      .select("id, theme_id, category, asset_key, storage_path")
      .eq("theme_id", themeId);

    if (error !== null) {
      throw new Error(error.message);
    }

    return (data ?? []).map(mapAssetRow);
  },

  async uploadAsset(
    themeId: string,
    category: string,
    assetKey: string,
    file: File,
  ): Promise<ThemeAsset> {
    const extension = file.name.split(".").at(-1) ?? "png";
    const storagePath = `${themeId}/${category}/${assetKey}.${extension}`;

    // Upload to storage (upsert to overwrite existing)
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { upsert: true });

    if (uploadError !== null) {
      throw new Error(uploadError.message);
    }

    // Upsert theme_assets record
    const { data, error } = await supabase
      .from("theme_assets")
      .upsert(
        {
          theme_id: themeId,
          category,
          asset_key: assetKey,
          storage_path: storagePath,
        },
        { onConflict: "theme_id,category,asset_key" },
      )
      .select("id, theme_id, category, asset_key, storage_path")
      .single();

    if (error !== null) {
      throw new Error(error.message);
    }

    return mapAssetRow(data);
  },

  async deleteAsset(assetId: string): Promise<void> {
    // Get the asset to find its storage path
    const { data: asset, error: fetchError } = await supabase
      .from("theme_assets")
      .select("storage_path")
      .eq("id", assetId)
      .single();

    if (fetchError !== null) {
      throw new Error(fetchError.message);
    }

    // Remove from storage
    await supabase.storage.from(STORAGE_BUCKET).remove([asset.storage_path]);

    // Remove database record
    const { error } = await supabase
      .from("theme_assets")
      .delete()
      .eq("id", assetId);

    if (error !== null) {
      throw new Error(error.message);
    }
  },

  getPublicUrl(storagePath: string): string {
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);
    return data.publicUrl;
  },
};
