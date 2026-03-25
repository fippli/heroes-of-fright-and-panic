import { type FormEvent, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { gamesApi } from "../../lib/api";
import { themesApi, type Theme } from "../../lib/theme-api";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";
import { GameMap } from "@shared/map/map";
import { defaultMapConfig } from "@shared/map/map";
import { createRandom } from "@shared/utils/random";
import { LandscapeType } from "@shared/map/landscape";
import type { Tile } from "@shared/map/tile";

// ============================================
// MAP PREVIEW
// ============================================

const TERRAIN_COLORS: Record<string, string> = {
  [LandscapeType.grass]: "#5a8a3c",
  [LandscapeType.tree]: "#2d5a1e",
  [LandscapeType.mountain]: "#8a7a6a",
  [LandscapeType.water]: "#2a5a8a",
  [LandscapeType.sand]: "#c4a95a",
  [LandscapeType.farm]: "#8aaa4a",
  [LandscapeType.unexplored]: "#333333",
};

const renderMapPreview = (
  ctx: CanvasRenderingContext2D,
  tiles: ReadonlyArray<Tile>,
  size: number,
): void => {
  const dpr = window.devicePixelRatio ?? 1;
  const hexRadius = Math.min(8, 200 / size);
  const hexWidth = hexRadius * Math.sqrt(3);
  const hexHeight = hexRadius * 2;
  const canvasWidth = size * hexWidth + hexWidth / 2 + 10;
  const canvasHeight = size * hexHeight * 0.75 + hexHeight * 0.25 + 10;

  ctx.canvas.width = canvasWidth * dpr;
  ctx.canvas.height = canvasHeight * dpr;
  ctx.canvas.style.width = `${canvasWidth}px`;
  ctx.canvas.style.height = `${canvasHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = "#1d1d1b";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  tiles.forEach((tile) => {
    const centerX = tile.column * hexWidth + (tile.row % 2 === 1 ? hexWidth / 2 : 0) + hexWidth / 2 + 5;
    const centerY = tile.row * hexHeight * 0.75 + hexHeight / 2 + 5;
    const color = TERRAIN_COLORS[tile.landscape?.type ?? "unexplored"] ?? "#333";

    ctx.beginPath();
    Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 3) * index - Math.PI / 6;
      const pointX = centerX + hexRadius * Math.cos(angle);
      const pointY = centerY + hexRadius * Math.sin(angle);
      if (index === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  });
};

// ============================================
// FORM STATE
// ============================================

type CreateFormState = {
  readonly name: string;
  readonly size: number;
  readonly alliance: "day" | "night";
  readonly inviteEmail: string;
  readonly themeId: string;
  readonly forestDensity: number;
  readonly mountainDensity: number;
  readonly waterLevel: number;
  readonly aiOpponent: boolean;
};

// ============================================
// COMPONENT
// ============================================

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
    forestDensity: defaultMapConfig.forestDensity,
    mountainDensity: defaultMapConfig.mountainDensity,
    waterLevel: defaultMapConfig.waterLevel,
    aiOpponent: false,
  });
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seedRef = useRef(Math.random().toString(36).slice(2, 10));

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

      themesApi
        .getAll()
        .then((loadedThemes) => {
          setThemes(loadedThemes);
          const defaultTheme = loadedThemes.find(
            (theme) => theme.name === "Default",
          );
          if (defaultTheme !== undefined) {
            setFormState((current) => ({
              ...current,
              themeId: defaultTheme.id,
            }));
          }
        })
        .catch(console.error);
    })();

    return () => {
      controller.abort();
    };
  }, [navigate]);

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const random = createRandom(seedRef.current);
    const config = {
      forestDensity: formState.forestDensity,
      mountainDensity: formState.mountainDensity,
      waterLevel: formState.waterLevel,
    };
    const tiles = GameMap.generate(formState.size, random, config) as Tile[];
    renderMapPreview(ctx, tiles, formState.size);
  }, [formState.size, formState.forestDensity, formState.mountainDensity, formState.waterLevel]);

  useEffect(() => {
    if (!isCheckingAuth) {
      renderPreview();
    }
  }, [renderPreview, isCheckingAuth]);

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
        aiOpponent: formState.aiOpponent,
        mapConfig: {
          forestDensity: formState.forestDensity,
          mountainDensity: formState.mountainDensity,
          waterLevel: formState.waterLevel,
        },
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
          <label htmlFor="water">Water: {Math.round(formState.waterLevel * 100)}%</label>
          <input
            type="range"
            id="water"
            min={0}
            max={100}
            value={Math.round(formState.waterLevel * 100)}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                waterLevel: Number(event.target.value) / 100,
              }))
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="forest">Forest: {Math.round(formState.forestDensity * 100)}%</label>
          <input
            type="range"
            id="forest"
            min={0}
            max={100}
            value={Math.round(formState.forestDensity * 100)}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                forestDensity: Number(event.target.value) / 100,
              }))
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="mountain">Mountain: {Math.round(formState.mountainDensity * 100)}%</label>
          <input
            type="range"
            id="mountain"
            min={0}
            max={100}
            value={Math.round(formState.mountainDensity * 100)}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                mountainDensity: Number(event.target.value) / 100,
              }))
            }
          />
        </div>

        <div className="form-group">
          <canvas ref={canvasRef} style={{ borderRadius: "8px", maxWidth: "100%" }} />
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

        <div className="form-group">
          <label htmlFor="aiOpponent" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="aiOpponent"
              checked={formState.aiOpponent}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  aiOpponent: event.target.checked,
                  inviteEmail: event.target.checked ? "" : current.inviteEmail,
                }))
              }
              style={{ width: "auto" }}
            />
            AI Opponent (single player)
          </label>
        </div>

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
            <option value="">None</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        {!formState.aiOpponent && (
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
        )}

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
