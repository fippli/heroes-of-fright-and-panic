import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { gamesApi } from "../../lib/api";
import { themesApi, type Theme } from "../../lib/theme-api";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";

type CreateFormState = {
  name: string;
  size: number;
  alliance: "day" | "night";
  inviteEmail: string;
  themeId: string;
};

export const NewGamePage = () => {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themes, setThemes] = useState<readonly Theme[]>([]);
  const [formState, setFormState] = useState<CreateFormState>({
    name: "",
    size: 40,
    alliance: "day",
    inviteEmail: "",
    themeId: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (controller.signal.aborted) return;

      if (
        authError !== null ||
        data.user === null ||
        data.user.email === undefined
      ) {
        navigate("/signin");
        return;
      }

      setIsCheckingAuth(false);

      // Load available themes
      themesApi.getAll().then(setThemes).catch(console.error);
    })();

    return () => {
      controller.abort();
    };
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = formState.name.trim();
    if (trimmedName === "") {
      setError("Please enter a game name");
      return;
    }

    setIsCreating(true);
    try {
      const game = await gamesApi.create({
        name: trimmedName,
        size: formState.size,
        alliance: formState.alliance,
        inviteEmail:
          formState.inviteEmail.trim() !== ""
            ? formState.inviteEmail.trim()
            : null,
        themeId: formState.themeId !== "" ? formState.themeId : null,
      });
      const newGameId = game.id ?? game._id;
      if (newGameId !== undefined) {
        navigate(`/game/${newGameId}?player=${formState.alliance}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create game";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <SplitLayout pageTitle="New Game">
      {error !== null && (
        <div className="message message--error">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formState.name}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="size">Size:</label>
          <select
            id="size"
            name="size"
            value={String(formState.size)}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                size: Number(event.target.value),
              }))
            }
          >
            <option value="25">Small (25x25)</option>
            <option value="40">Medium (40x40)</option>
            <option value="55">Large (55x55)</option>
            <option value="70">Huge (70x70)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="alliance">Alliance:</label>
          <select
            id="alliance"
            name="alliance"
            value={formState.alliance}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                alliance: event.target.value as "day" | "night",
              }))
            }
          >
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </div>

        {themes.length !== 0 && (
          <div className="form-group">
            <label htmlFor="theme">Theme:</label>
            <select
              id="theme"
              name="theme"
              value={formState.themeId}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  themeId: event.target.value,
                }))
              }
            >
              <option value="">Default</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="invite">Invite:</label>
          <input
            type="email"
            id="invite"
            name="invite"
            placeholder="email@example.com"
            value={formState.inviteEmail}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                inviteEmail: event.target.value,
              }))
            }
          />
        </div>

        <div className="row">
          <Link to="/games" className="btn btn--secondary">
            Cancel
          </Link>
          <button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </SplitLayout>
  );
};
