import { type DragEvent, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAdmin } from "../../lib/use-admin";
import { themesApi, type ThemeAsset } from "../../lib/theme-api";
import {
  getDayPieceSlots,
  getNightPieceSlots,
  getSharedPieceSlots,
  getSlotsByCategory,
  getShortLabel,
} from "../../images/asset-keys";
import "./theme-editor.css";

type AssetSlot = {
  readonly category: string;
  readonly key: string;
  readonly label: string;
};

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
    event: DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    setDragOver(null);

    const file = event.dataTransfer.files.item(0);
    if (file === null) return;
    if (!file.type.startsWith("image/")) return;

    uploadFile(category, assetKey, file);
  };

  const handleDragOver = (
    slotKey: string,
    event: DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    setDragOver(slotKey);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleFileSelect = (
    category: string,
    assetKey: string,
    fileList: FileList | null,
  ) => {
    if (fileList === null) return;
    const file = fileList.item(0);
    if (file === null) return;

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

  const renderSlot = (slot: AssetSlot) => {
    const existingAsset = findAsset(slot.category, slot.key);
    const slotKey = `${slot.category}/${slot.key}`;
    const isUploading = uploading === slotKey;
    const isDraggedOver = dragOver === slotKey;

    return (
      <div
        key={slotKey}
        className={[
          "te-slot",
          isDraggedOver ? "te-slot--drag-over" : "",
          isUploading ? "te-slot--uploading" : "",
        ].join(" ")}
        onDrop={(event) => handleDrop(slot.category, slot.key, event)}
        onDragOver={(event) => handleDragOver(slotKey, event)}
        onDragLeave={handleDragLeave}
      >
        {existingAsset !== undefined ? (
          <div className="te-slot__preview">
            <img
              src={themesApi.getPublicUrl(existingAsset.storagePath)}
              alt={slot.label}
              className="te-slot__image"
            />
            <button
              type="button"
              className="te-slot__remove"
              onClick={() => handleDeleteAsset(existingAsset.id)}
              title="Remove"
            >
              x
            </button>
          </div>
        ) : (
          <label className="te-slot__dropzone">
            {isUploading ? "..." : "+"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) =>
                handleFileSelect(slot.category, slot.key, event.target.files)
              }
              disabled={isUploading}
            />
          </label>
        )}
        <div className="te-slot__label">{getShortLabel(slot)}</div>
      </div>
    );
  };

  const renderSection = (title: string, slots: readonly AssetSlot[]) => (
    <div className="te-section">
      <h3 className="te-section__title">{title}</h3>
      <div className="te-section__grid">
        {slots.map(renderSlot)}
      </div>
    </div>
  );

  if (isLoading) {
    return null;
  }

  if (!isAdmin || themeId === undefined) {
    return (
      <div className="te-page">
        <p className="message message--error">
          {themeId === undefined ? "No theme ID provided." : "No admin access."}
        </p>
        <Link to="/admin/themes" className="btn btn--secondary">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="te-page">
      {error !== null && (
        <div className="message message--error">{error}</div>
      )}

      <div className="te-columns">
        <div className="te-column te-column--night">
          <h2 className="te-column__title">Night</h2>
          {renderSection("Pieces", getNightPieceSlots())}
        </div>

        <div className="te-column te-column--shared">
          {renderSection("Shared", getSharedPieceSlots())}
          {renderSection("Buildings", getSlotsByCategory("building"))}
          {renderSection("Landscape", getSlotsByCategory("landscape"))}
          <Link to="/admin/themes" className="btn btn--secondary te-back">
            Back to Themes
          </Link>
        </div>

        <div className="te-column te-column--day">
          <h2 className="te-column__title">Day</h2>
          {renderSection("Pieces", getDayPieceSlots())}
        </div>
      </div>
    </div>
  );
};
