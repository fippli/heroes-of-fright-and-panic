import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";
import { useAdmin } from "../../lib/use-admin";
import { themesApi, type Theme } from "../../lib/theme-api";

export const AdminPage = () => {
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [themes, setThemes] = useState<readonly Theme[]>([]);
  const [themeName, setThemeName] = useState("");
  const [themeDescription, setThemeDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      themesApi.getAll().then(setThemes).catch(console.error);
    }
  }, [isLoading, isAdmin]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = themeName.trim();
    if (trimmedName === "") {
      setError("Please enter a theme name");
      return;
    }

    setIsCreating(true);
    try {
      const newTheme = await themesApi.create({
        name: trimmedName,
        description: themeDescription.trim(),
      });
      setThemes((current) => [newTheme, ...current]);
      setThemeName("");
      setThemeDescription("");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to create theme";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (themeId: string) => {
    try {
      await themesApi.delete(themeId);
      setThemes((current) => current.filter((theme) => theme.id !== themeId));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to delete theme";
      setError(message);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <SplitLayout pageTitle="Admin">
        <p className="message message--error">
          You do not have admin access.
        </p>
        <Link to="/games" className="btn btn--secondary">
          Back to Games
        </Link>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout pageTitle="Themes">
      {error !== null && (
        <div className="message message--error">{error}</div>
      )}

      <form onSubmit={handleCreate}>
        <div className="form-group">
          <label htmlFor="theme-name">Name:</label>
          <input
            type="text"
            id="theme-name"
            value={themeName}
            onChange={(event) => setThemeName(event.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="theme-description">Description:</label>
          <input
            type="text"
            id="theme-description"
            value={themeDescription}
            onChange={(event) => setThemeDescription(event.target.value)}
          />
        </div>
        <div className="row">
          <button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Theme"}
          </button>
        </div>
      </form>

      <div className="theme-list">
        {themes.map((theme) => (
          <div key={theme.id} className="theme-list__item">
            <div className="theme-list__info">
              <strong>{theme.name}</strong>
              {theme.description !== null && theme.description !== "" && (
                <span className="text-muted"> - {theme.description}</span>
              )}
            </div>
            <div className="theme-list__actions">
              <Link
                to={`/admin/theme/${theme.id}`}
                className="btn btn--small"
              >
                Edit
              </Link>
              <button
                type="button"
                className="btn btn--small btn--secondary"
                onClick={() => handleDelete(theme.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {themes.length === 0 && (
          <p className="text-muted">No themes yet. Create one above.</p>
        )}
      </div>

      <div className="row" style={{ marginTop: "2rem" }}>
        <Link to="/games" className="btn btn--secondary">
          Back to Games
        </Link>
      </div>
    </SplitLayout>
  );
};
