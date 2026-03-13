import { type DragEvent, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAdmin } from "../../lib/use-admin";
import { themesApi, type ThemeAsset } from "../../lib/theme-api";
import { ASSET_SLOTS } from "../../images/asset-keys";

type Tab = "day" | "night" | "buildings" | "landscape";

const TAB_LABELS: readonly { readonly tab: Tab; readonly label: string }[] = [
  { tab: "day", label: "Day" },
  { tab: "night", label: "Night" },
  { tab: "buildings", label: "Buildings" },
  { tab: "landscape", label: "Landscape" },
];

const getSlotsForTab = (tab: Tab) =>
  ASSET_SLOTS.filter((slot) => {
    switch (tab) {
      case "day":
        return slot.category === "piece" && slot.key.endsWith("_day");
      case "night":
        return slot.category === "piece" && slot.key.endsWith("_night");
      case "buildings":
        return (
          slot.category === "building" ||
          (slot.category === "piece" &&
            !slot.key.endsWith("_day") &&
            !slot.key.endsWith("_night"))
        );
      case "landscape":
        return slot.category === "landscape";
    }
  });

export const ThemeEditorPage = () => {
  const { themeId } = useParams();
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<readonly ThemeAsset[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("day");

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

  if (!isAdmin || themeId === undefined) {
    return (
      <div style={{ padding: "2rem" }}>
        <p className="message message--error">
          {themeId === undefined ? "No theme ID provided." : "No admin access."}
        </p>
        <Link to="/admin/themes" className="btn btn--secondary">
          Back
        </Link>
      </div>
    );
  }

  const activeSlots = getSlotsForTab(activeTab);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        margin: "calc(-1 * var(--spacing-2xl))",
      }}
    >
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-sm)",
          padding: "var(--spacing-lg)",
          minWidth: "160px",
        }}
      >
        {TAB_LABELS.map(({ tab, label }) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              textAlign: "left",
              fontWeight: activeTab === tab ? "900" : "normal",
              opacity: activeTab === tab ? 1 : 0.6,
            }}
          >
            {label}
          </button>
        ))}
        <Link
          to="/admin/themes"
          className="btn btn--secondary"
          style={{ marginTop: "auto" }}
        >
          Back
        </Link>
      </nav>

      <div
        style={{
          flex: 1,
          padding: "var(--spacing-lg)",
          overflowY: "auto",
        }}
      >
        {error !== null && (
          <div className="message message--error">{error}</div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: "var(--spacing-sm)",
          }}
        >
          {activeSlots.map((slot) => {
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
                    onDrop={(event) =>
                      handleDrop(slot.category, slot.key, event)
                    }
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
      </div>
    </div>
  );
};
