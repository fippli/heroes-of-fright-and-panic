import { useEffect, useState } from "react";
import { themesApi, type Theme } from "../../lib/theme-api";
import { ImageAssets, defaultImageAssets } from "../../images";
import { ThemeImageAssets } from "../../images/theme-image-assets";
import type { Game } from "../../core/Board";

export const BUILT_IN_THEME = "builtin";

/** Per-game theme preference, so a refresh keeps the look you picked */
export const themePreferenceKey = (gameId: string): string => `dusk-dawn:theme:${gameId}`;

export const readThemePreference = (gameId: string): string | null => {
  try {
    return window.localStorage.getItem(themePreferenceKey(gameId));
  } catch {
    return null;
  }
};

export const loadImageAssets = async (themeId: string | null): Promise<ImageAssets> => {
  if (themeId === null || themeId === BUILT_IN_THEME) return defaultImageAssets;
  return new ImageAssets(await ThemeImageAssets.fromThemeId(themeId));
};

export const GameSettings = ({
  game,
  gameId,
  initialThemeId,
  open,
  onClose,
}: {
  readonly game: Game;
  readonly gameId: string;
  readonly initialThemeId: string | null;
  readonly open: boolean;
  readonly onClose: () => void;
}) => {
  const [themes, setThemes] = useState<readonly Theme[]>([]);
  const [themeId, setThemeId] = useState<string>(initialThemeId ?? BUILT_IN_THEME);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    themesApi
      .getAll()
      .then(setThemes)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Could not load themes"),
      );
  }, []);

  const changeTheme = async (nextThemeId: string): Promise<void> => {
    setThemeId(nextThemeId);
    setLoading(true);
    setError(null);
    try {
      game.setImageAssets(await loadImageAssets(nextThemeId));
      try {
        window.localStorage.setItem(themePreferenceKey(gameId), nextThemeId);
      } catch {
        // Preference is a convenience; ignore storage failures
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load theme");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <section className="panel settings-pop" role="dialog" aria-label="Settings">
      <div className="settings-pop__head">
        <h2>Settings</h2>
        <button type="button" className="action-btn selection__close" onClick={onClose} title="Close">×</button>
      </div>
      <label className="setting">
        <span>Theme</span>
        <select
          value={themeId}
          disabled={loading}
          onChange={(event) => void changeTheme(event.target.value)}
        >
          <option value={BUILT_IN_THEME}>Built-in</option>
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">Only changes how the board looks for you. Remembered for this game.</p>
      {error !== null && <p className="hint hint--error">{error}</p>}
    </section>
  );
};
