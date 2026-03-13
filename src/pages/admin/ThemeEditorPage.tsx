import { type DragEvent, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";
import { useAdmin } from "../../lib/use-admin";
import { themesApi, type ThemeAsset } from "../../lib/theme-api";
import { ASSET_SLOTS } from "../../images/asset-keys";

export const ThemeEditorPage = () => {
  const { themeId } = useParams();
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<readonly ThemeAsset[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
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

  const uploadFile = async (
    category: string,
    assetKey: string,
    file: File,
  ) => {
    if (themeId === undefined) return;

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

  const handleDrop = (
    category: string,
    assetKey: string,
    event: DragEvent<HTMLLabelElement>,
  ) => {
    event.preventDefault();
    setDragOver(null);

    const file = event.dataTransfer.files.item(0);
    if (file === null) return;
    if (!file.type.startsWith("image/")) return;

    uploadFile(category, assetKey, file);
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
        <Link to="/admin/themes" className="btn btn--secondary">
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: "8px",
        }}
      >
        {ASSET_SLOTS.map((slot) => {
          const existingAsset = findAsset(slot.category, slot.key);
          const slotKey = `${slot.category}/${slot.key}`;
          const isUploading = uploading === slotKey;
          const isDraggedOver = dragOver === slotKey;

          return (
            <div key={slotKey}>
              {existingAsset !== undefined ? (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    position: "relative",
                  }}
                >
                  <img
                    src={themesApi.getPublicUrl(existingAsset.storagePath)}
                    alt={slot.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteAsset(existingAsset.id)}
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      padding: "0 4px",
                      fontSize: "0.7rem",
                    }}
                  >
                    x
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    aspectRatio: "1",
                    border: isDraggedOver
                      ? "2px solid currentColor"
                      : "2px dashed currentColor",
                    cursor: "pointer",
                    fontSize: "1.5rem",
                    opacity: isUploading ? 0.5 : 1,
                  }}
                  onDrop={(event) => handleDrop(slot.category, slot.key, event)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(slotKey);
                  }}
                  onDragLeave={() => setDragOver(null)}
                >
                  {isUploading ? "..." : "+"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.item(0);
                      if (file !== undefined && file !== null) {
                        uploadFile(slot.category, slot.key, file);
                      }
                    }}
                    disabled={isUploading}
                  />
                </label>
              )}
              <div style={{ fontSize: "0.75rem", textAlign: "center" }}>
                {slot.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: "1rem" }}>
        <Link to="/admin/themes" className="btn btn--secondary">
          Back to Themes
        </Link>
      </div>
    </SplitLayout>
  );
};
