import { type ChangeEvent, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";
import { useAdmin } from "../../lib/use-admin";
import { themesApi, type ThemeAsset } from "../../lib/theme-api";
import {
  ASSET_CATEGORIES,
  getSlotsByCategory,
} from "../../images/asset-keys";

export const ThemeEditorPage = () => {
  const { themeId } = useParams();
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<readonly ThemeAsset[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!isLoading && isAdmin && themeId !== undefined) {
      themesApi.getAssets(themeId).then(setAssets).catch(console.error);
    }
  }, [isLoading, isAdmin, themeId]);

  const findAsset = (
    category: string,
    assetKey: string,
  ): ThemeAsset | undefined =>
    assets.find(
      (asset) => asset.category === category && asset.assetKey === assetKey,
    );

  const handleUpload = async (
    category: string,
    assetKey: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    if (themeId === undefined) return;
    const file = event.target.files?.item(0);
    if (file === undefined || file === null) return;

    const slotKey = `${category}/${assetKey}`;
    setUploading(slotKey);
    setError(null);

    try {
      const newAsset = await themesApi.uploadAsset(
        themeId,
        category,
        assetKey,
        file,
      );
      setAssets((current) =>
        current
          .filter(
            (asset) =>
              !(asset.category === category && asset.assetKey === assetKey),
          )
          .concat(newAsset),
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    setError(null);
    try {
      await themesApi.deleteAsset(assetId);
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Delete failed";
      setError(message);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <SplitLayout pageTitle="Theme Editor">
        <p className="message message--error">
          You do not have admin access.
        </p>
        <Link to="/games" className="btn btn--secondary">
          Back to Games
        </Link>
      </SplitLayout>
    );
  }

  if (themeId === undefined) {
    return (
      <SplitLayout pageTitle="Theme Editor">
        <p className="message message--error">No theme ID provided.</p>
        <Link to="/admin" className="btn btn--secondary">
          Back to Themes
        </Link>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout pageTitle="Theme Editor">
      {error !== null && (
        <div className="message message--error">{error}</div>
      )}

      {ASSET_CATEGORIES.map((category) => (
        <section key={category} className="theme-editor__category">
          <h3 className="theme-editor__category-title">
            {category.at(0)?.toUpperCase()}{category.slice(1)}
          </h3>
          <div className="theme-editor__grid">
            {getSlotsByCategory(category).map((slot) => {
              const existingAsset = findAsset(slot.category, slot.key);
              const slotKey = `${slot.category}/${slot.key}`;
              const isUploading = uploading === slotKey;

              return (
                <div key={slot.key} className="theme-editor__slot">
                  <div className="theme-editor__slot-label">{slot.label}</div>
                  {existingAsset !== undefined && (
                    <div className="theme-editor__slot-preview">
                      <img
                        src={themesApi.getPublicUrl(existingAsset.storagePath)}
                        alt={slot.label}
                        className="theme-editor__thumbnail"
                      />
                      <button
                        type="button"
                        className="btn btn--small btn--secondary"
                        onClick={() => handleDeleteAsset(existingAsset.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <label className="btn btn--small theme-editor__upload-btn">
                    {isUploading ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(event) =>
                        handleUpload(slot.category, slot.key, event)
                      }
                      disabled={isUploading}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="row" style={{ marginTop: "2rem" }}>
        <Link to="/admin" className="btn btn--secondary">
          Back to Themes
        </Link>
      </div>
    </SplitLayout>
  );
};
