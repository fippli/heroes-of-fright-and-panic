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
import { profilesApi } from "../../lib/profiles";
import { AddFriendDialog } from "../friends/AddFriendDialog";
import { themesApi, type Theme } from "../../lib/theme-api";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";
import { ErrorBox } from "../../components/ErrorBox";
import { GameMap } from "@shared/map/map";
import { defaultMapConfig } from "@shared/map/map";
import { createRandom } from "@shared/utils/random";
import { LandscapeType } from "@shared/map/landscape";
import { neighborAt as hexNeighborAt } from "@shared/map/hex";
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
  // Fill the column; the buffer keeps the map's aspect ratio
  ctx.canvas.style.width = "100%";
  ctx.canvas.style.height = "auto";
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

  // Rivers on top: a stroke between the two edge midpoints of each segment
  const centerOf = (row: number, column: number): readonly [number, number] => [
    column * hexWidth + (row % 2 === 1 ? hexWidth / 2 : 0) + hexWidth / 2 + 5,
    row * hexHeight * 0.75 + hexHeight / 2 + 5,
  ];
  ctx.lineCap = "round";
  tiles.forEach((tile) => {
    if (tile.river == null) return;
    const [cx, cy] = centerOf(tile.row, tile.column);
    const enter = hexNeighborAt(tile, tile.river.entry);
    const exit = hexNeighborAt(tile, tile.river.exit);
    const [ex, ey] = centerOf(enter.row, enter.column);
    const [xx, xy] = centerOf(exit.row, exit.column);
    ctx.beginPath();
    ctx.moveTo((cx + ex) / 2, (cy + ey) / 2);
    ctx.quadraticCurveTo(cx, cy, (cx + xx) / 2, (cy + xy) / 2);
    // Light banks, dark deep middle
    ctx.strokeStyle = "#7db3de";
    ctx.lineWidth = Math.max(1.5, hexRadius / 2);
    ctx.stroke();
    ctx.strokeStyle = "#27567f";
    ctx.lineWidth = Math.max(1, hexRadius / 4);
    ctx.stroke();
  });
};

// ============================================
// FORM STATE
// ============================================

type CreateFormState = {
  readonly name: string;
  readonly size: number;
  readonly alliance: "day" | "night";
  /** The other seat: "" = open, "AI", a friend's username, or an email */
  readonly opponent: string;
  readonly themeId: string;
  readonly forestDensity: number;
  readonly mountainDensity: number;
  readonly waterLevel: number;
};

const SIZES: readonly { readonly label: string; readonly value: number }[] = [
  { label: "xs", value: 25 },
  { label: "s", value: 32 },
  { label: "m", value: 40 },
  { label: "l", value: 55 },
  { label: "xl", value: 70 },
];

// ============================================
// COMPONENT
// ============================================

export const NewGamePage = () => {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [themes, setThemes] = useState<readonly Theme[]>([]);
  const [friendNames, setFriendNames] = useState<readonly string[]>([]);
  const [ownName, setOwnName] = useState<string | null>(null);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [formState, setFormState] = useState<CreateFormState>({
    name: "",
    size: 40,
    alliance: "day",
    opponent: "",
    themeId: "",
    forestDensity: defaultMapConfig.forestDensity,
    mountainDensity: defaultMapConfig.mountainDensity,
    waterLevel: defaultMapConfig.waterLevel,
  });
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 10));

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

      profilesApi
        .friends()
        .then((entries) => {
          setFriendNames(
            entries
              .filter((entry) => entry.status === "friends")
              .map((entry) => entry.username)
              .sort(),
          );
        })
        .catch(console.error);

      profilesApi
        .getOwn()
        .then((profile) => setOwnName(profile?.username ?? null))
        .catch(console.error);

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

  // Regenerating the map on every slider tick lags; the sliders bump
  // previewTick only when released, and the ref keeps the values fresh
  const [previewTick, setPreviewTick] = useState(0);
  const formStateRef = useRef(formState);
  formStateRef.current = formState;

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const current = formStateRef.current;
    const random = createRandom(seed);
    const config = {
      forestDensity: current.forestDensity,
      mountainDensity: current.mountainDensity,
      waterLevel: current.waterLevel,
    };
    const tiles = GameMap.generate(current.size, random, config) as Tile[];
    renderMapPreview(ctx, tiles, current.size);
  }, [seed, previewTick, formState.size]);

  useEffect(() => {
    if (!isCheckingAuth) {
      renderPreview();
    }
  }, [renderPreview, isCheckingAuth]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedName = formState.name.trim();
    if (trimmedName === "") {
      setError("Please enter a game name");
      return;
    }

    // The opponent field folds every seat option into one value
    const opponent = formState.opponent.trim();
    const aiOpponent = opponent.toLowerCase() === "ai";
    const inviteEmail = !aiOpponent && opponent.includes("@") ? opponent : null;
    const inviteUsername =
      !aiOpponent && inviteEmail === null && opponent !== "" ? opponent : null;

    setIsCreating(true);
    try {
      const game = await gamesApi.create({
        name: trimmedName,
        size: formState.size,
        alliance: formState.alliance,
        seed,
        aiOpponent,
        inviteUsername,
        inviteEmail,
        themeId: formState.themeId !== "" ? formState.themeId : null,
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
    <SplitLayout pageTitle="New Game" maxW="880px">
      {error !== null && <ErrorBox>{error}</ErrorBox>}
      <AddFriendDialog
        open={addFriendOpen}
        onClose={() => setAddFriendOpen(false)}
        onAdded={(username) =>
          setFormState((current) =>
            current.opponent === "" ? { ...current, opponent: username } : current,
          )
        }
      />

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
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Players</Field.Label>
          <VStack gap="2" align="stretch" w="100%">
            <Flex gap="2">
              <Flex flex="1" align="center" px="3" bg="rgba(0, 0, 0, 0.08)" borderRadius="md" fontWeight="900" color="brand.contrast">
                {ownName ?? "You"}&nbsp;<Text as="span" fontWeight="700" opacity={0.6}>(you)</Text>
              </Flex>
              <Box w="150px">
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
              </Box>
            </Flex>
            <Flex gap="2">
              <Box flex="1">
                <Input
                  list="opponent-options"
                  placeholder="AI, a friend, an email — or leave open and share the link"
                  value={formState.opponent}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, opponent: event.target.value }))
                  }
                  bg="white"
                  color="brand.contrast"
                  fontWeight="900"
                  border="none"
                />
                <datalist id="opponent-options">
                  <option value="AI" />
                  {friendNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </Box>
              <Flex w="150px" align="center" justify="center" bg="rgba(0, 0, 0, 0.08)" borderRadius="md" fontWeight="900" color="brand.contrast">
                {formState.alliance === "day" ? "Night" : "Day"}
              </Flex>
            </Flex>
            <Button
              type="button"
              alignSelf="flex-start"
              size="xs"
              variant="outline"
              borderColor="brand.contrast"
              color="brand.contrast"
              _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}
              onClick={() => setAddFriendOpen(true)}
            >
              + Add new friend
            </Button>
          </VStack>
        </Field.Root>

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

        <Flex gap="6" direction={{ base: "column", md: "row" }} align="flex-start">
          <VStack flex="1" gap="4" align="stretch" minW="0">
            <Field.Root>
              <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">
                Water: {Math.round(formState.waterLevel * 100)}%
              </Field.Label>
              <input
                type="range"
                style={{ width: "100%" }}
                onPointerUp={() => setPreviewTick((tick) => tick + 1)}
                onKeyUp={() => setPreviewTick((tick) => tick + 1)}
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
                style={{ width: "100%" }}
                onPointerUp={() => setPreviewTick((tick) => tick + 1)}
                onKeyUp={() => setPreviewTick((tick) => tick + 1)}
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
                style={{ width: "100%" }}
                onPointerUp={() => setPreviewTick((tick) => tick + 1)}
                onKeyUp={() => setPreviewTick((tick) => tick + 1)}
                min={0}
                max={100}
                value={Math.round(formState.mountainDensity * 100)}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, mountainDensity: Number(event.target.value) / 100 }))
                }
              />
            </Field.Root>

          </VStack>

          <VStack flex="1" gap="2" align="stretch" minW="0">
            <HStack gap="0" w="100%" borderRadius="md" overflow="hidden" border="2px solid" borderColor="brand.contrast">
              {SIZES.map(({ label, value }) => (
                <Button
                  key={label}
                  type="button"
                  flex="1"
                  size="sm"
                  borderRadius="0"
                  bg={formState.size === value ? "brand.contrast" : "white"}
                  color={formState.size === value ? "brand.solid" : "brand.contrast"}
                  fontWeight="900"
                  _hover={{ bg: formState.size === value ? "#3d3d3b" : "rgba(0, 0, 0, 0.1)" }}
                  onClick={() => setFormState((current) => ({ ...current, size: value }))}
                  title={`${value}x${value}`}
                >
                  {label}
                </Button>
              ))}
            </HStack>
            <canvas ref={canvasRef} style={{ borderRadius: "8px", maxWidth: "100%" }} />
            <Button
              type="button"
              size="sm"
              bg="brand.contrast"
              color="brand.solid"
              _hover={{ bg: "#3d3d3b" }}
              onClick={() => setSeed(Math.random().toString(36).slice(2, 10))}
            >
              🎲 New map
            </Button>
          </VStack>
        </Flex>

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
