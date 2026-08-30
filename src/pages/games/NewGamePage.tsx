import { type FormEvent, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Field } from "@chakra-ui/react";
import { NativeSelect } from "@chakra-ui/react";
import { gamesApi } from "../../lib/api";
import { themesApi, type Theme } from "../../lib/theme-api";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";
import { ErrorBox } from "../../components/ErrorBox";
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
        navigate(`/game/${newGameId}`);
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
      {error !== null && <ErrorBox>{error}</ErrorBox>}

      <VStack as="form" onSubmit={handleSubmit} gap="4" align="stretch">
        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Name</Field.Label>
          <Input
            type="text"
            value={formState.name}
            onChange={(event) =>
              setFormState((current) => ({ ...current, name: event.target.value }))
            }
            required
            bg="white"
            color="brand.contrast"
            fontWeight="900"
            border="none"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Size</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={String(formState.size)}
              onChange={(event) =>
                setFormState((current) => ({ ...current, size: Number(event.target.value) }))
              }
              bg="white"
              color="brand.contrast"
              fontWeight="900"
              border="none"
            >
              <option value="25">Small (25x25)</option>
              <option value="40">Medium (40x40)</option>
              <option value="55">Large (55x55)</option>
              <option value="70">Huge (70x70)</option>
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Field.Root>

        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">
            Water: {Math.round(formState.waterLevel * 100)}%
          </Field.Label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(formState.waterLevel * 100)}
            onChange={(event) =>
              setFormState((current) => ({ ...current, waterLevel: Number(event.target.value) / 100 }))
            }
          />
        </Field.Root>

        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">
            Forest: {Math.round(formState.forestDensity * 100)}%
          </Field.Label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(formState.forestDensity * 100)}
            onChange={(event) =>
              setFormState((current) => ({ ...current, forestDensity: Number(event.target.value) / 100 }))
            }
          />
        </Field.Root>

        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">
            Mountain: {Math.round(formState.mountainDensity * 100)}%
          </Field.Label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(formState.mountainDensity * 100)}
            onChange={(event) =>
              setFormState((current) => ({ ...current, mountainDensity: Number(event.target.value) / 100 }))
            }
          />
        </Field.Root>

        <Box>
          <canvas ref={canvasRef} style={{ borderRadius: "8px", maxWidth: "100%" }} />
        </Box>

        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Alliance</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={formState.alliance}
              onChange={(event) =>
                setFormState((current) => ({ ...current, alliance: event.target.value as "day" | "night" }))
              }
              bg="white"
              color="brand.contrast"
              fontWeight="900"
              border="none"
            >
              <option value="day">Day</option>
              <option value="night">Night</option>
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Field.Root>

        <Flex align="center" gap="2">
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
          <Text as="label" htmlFor="aiOpponent" color="brand.contrast" fontWeight="700" fontSize="1.2rem" cursor="pointer">
            AI Opponent (single player)
          </Text>
        </Flex>

        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Theme</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={formState.themeId}
              onChange={(event) =>
                setFormState((current) => ({ ...current, themeId: event.target.value }))
              }
              bg="white"
              color="brand.contrast"
              fontWeight="900"
              border="none"
            >
              <option value="">None</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Field.Root>

        {!formState.aiOpponent && (
          <Field.Root>
            <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Invite</Field.Label>
            <Input
              type="email"
              placeholder="email@example.com"
              value={formState.inviteEmail}
              onChange={(event) =>
                setFormState((current) => ({ ...current, inviteEmail: event.target.value }))
              }
              bg="white"
              color="brand.contrast"
              fontWeight="900"
              border="none"
            />
          </Field.Root>
        )}

        <HStack gap="4">
          <ChakraLink asChild flex="1" textDecoration="none" _hover={{ textDecoration: "none" }}>
            <Link to="/games">
              <Button
                w="100%"
                variant="outline"
                borderColor="brand.contrast"
                color="brand.contrast"
                _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}
              >
                Cancel
              </Button>
            </Link>
          </ChakraLink>
          <Button
            type="submit"
            flex="1"
            disabled={isCreating}
            bg="brand.contrast"
            color="brand.solid"
            _hover={{ bg: "#3d3d3b" }}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </HStack>
      </VStack>
    </SplitLayout>
  );
};
