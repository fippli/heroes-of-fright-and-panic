import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Canvas } from "../../canvas";
import { Game } from "../../core/Board";
import { BuildingType } from "../../core/Building";
import { EquipmentType } from "@shared/equipment";
import { SteedType } from "@shared/steed";
import { ResearchType } from "@shared/research";
import { supabase, getEdgeFunctionError } from "../../lib/supabase";
import type { Coordinate } from "../../types/coordinate";
import type { GameUiState } from "../../core/ui-state";
import { BuildMenu } from "./BuildMenu";
import { GameSettings, loadImageAssets, readThemePreference } from "./GameSettings";
import { installErrorReporting, reportClientError } from "../../lib/error-report";
import "./game.css";

export const GamePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const canvasInstanceRef = useRef<Canvas | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { id: gameId } = useParams();
  const [searchParams] = useSearchParams();
  const playerParam = searchParams.get("player");
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<GameUiState | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);

  const isSpectator = playerParam === "spectator";

  // Validate player param
  const myPlayerType: "day" | "night" | null =
    playerParam === "day" || playerParam === "night" ? playerParam : null;

  useEffect(() => {
    if (
      canvasRef.current === null ||
      wrapperRef.current === null ||
      gameId === undefined ||
      (myPlayerType === null && !isSpectator)
    ) {
      return;
    }

    const canvasElement = canvasRef.current;
    const wrapperElement = wrapperRef.current;

    // Create canvas instance
    const canvas = new Canvas(canvasElement, wrapperElement);
    canvasInstanceRef.current = canvas;

    const uninstallErrorReporting = installErrorReporting({ gameId, player: myPlayerType });

    // Render loop. A throwing frame is reported once and skipped; the loop
    // must keep running or the board freezes.
    const startRenderLoop = (game: Game) => {
      let renderErrorReported = false;
      const loop = () => {
        if (canvas.ctx === null) {
          return;
        }

        try {
          canvas.init();
          game.render();
        } catch (renderError) {
          if (!renderErrorReported) {
            renderErrorReported = true;
            reportClientError({
              gameId,
              player: myPlayerType,
              message: renderError instanceof Error ? renderError.message : String(renderError),
              stack: renderError instanceof Error ? renderError.stack : undefined,
              context: { source: "render" },
            });
          }
        } finally {
          canvas.reset();
        }

        animationFrameRef.current = requestAnimationFrame(loop);
      };

      loop();
    };

    // Fetch initial game state, load theme if present, then start
    supabase.functions
      .invoke("game-state", { body: { gameId } })
      .then(async ({ data, error: invokeError }) => {
        if (invokeError !== null) {
          throw new Error(await getEdgeFunctionError(invokeError));
        }

        // Theme: a per-game preference from Settings wins over the game's own theme
        const gameThemeId: string | null = data.themeId ?? data.theme_id ?? null;
        const themeId = readThemePreference(gameId) ?? gameThemeId;
        const imageAssets = await loadImageAssets(themeId);
        setActiveThemeId(themeId);

        const game = new Game(canvas, myPlayerType, imageAssets);
        gameRef.current = game;
        game.subscribe(setUi);

        game.parse(data);
        console.log("Game loaded:", game.id, "Playing as:", myPlayerType);
        startRenderLoop(game);

        // Input handlers
        canvas.click((position: Coordinate) => game.click(position));

        canvas.keydown({
          // Build mode: pick a building, then click a tile
          h: () => game.setPendingBuild(BuildingType.house),
          t: () => game.setPendingBuild(BuildingType.tower),
          w: () => game.setPendingBuild(BuildingType.wall),
          r: () => game.setPendingBuild(BuildingType.church),
          escape: () => game.cancel(),
          " ": () => void game.passTurn(false),
          "shift+ ": () => void game.passTurn(true),

          // Unit actions
          p: (position) => game.spawnPeasant(position),
          s: (position) => game.craftEquipment(EquipmentType.sword, position),
          d: (position) => game.craftEquipment(EquipmentType.shield, position),
          b: (position) => game.craftEquipment(EquipmentType.bow, position),
          x: (position) => game.attack(position),

          // Building / unit actions (some need a selected source first)
          e: (position) => game.enterTower(position), // king selected → tower
          n: (position) => game.trainPriest(position), // on church
          m: (position) => game.summonArchAngel(position), // on church
          g: (position) => game.heal(position), // priest selected → ally
          o: (position) => game.buySteed(SteedType.horse, position), // house → tile
          f: (position) => game.buySteed(SteedType.boat, position), // house → water
          "4": (position) => game.research(ResearchType.speed, position), // castle
          "5": (position) => game.research(ResearchType.miningII, position),
          "6": (position) => game.research(ResearchType.miningIII, position),
          "7": (position) => game.research(ResearchType.queen, position),
        });
      })
      .catch((err) => {
        console.error("Error loading game:", err);
        reportClientError({
          gameId,
          player: myPlayerType,
          message: err instanceof Error ? err.message : "Failed to load game",
          stack: err instanceof Error ? err.stack : undefined,
          context: { source: "load" },
        });
        setError(err instanceof Error ? err.message : "Failed to load game");
      });

    // Cleanup on unmount
    return () => {
      uninstallErrorReporting();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameId, myPlayerType, isSpectator]);

  // Show error state
  if (error !== null) {
    return (
      <Flex className="game-body" align="center" justify="center">
        <VStack gap="4" textAlign="center" maxW="600px" p="10">
          <Heading
            fontSize="3rem"
            bgGradient="to-r"
            gradientFrom="#ffd54f"
            gradientTo="#ff6f00"
            bgClip="text"
          >
            Dusk and Dawn
          </Heading>
          <Box
            bg="rgba(255, 87, 34, 0.15)"
            border="1px solid #ff5722"
            color="#ffab91"
            p="3"
            borderRadius="lg"
            fontWeight="700"
          >
            {error}
          </Box>
          <ChakraLink
            asChild
            textDecoration="none"
            _hover={{ textDecoration: "none" }}
          >
            <Link to="/games">
              <Button bg="#ffd54f" color="#0b0906" fontWeight="700" size="lg">
                Back to Games
              </Button>
            </Link>
          </ChakraLink>
        </VStack>
      </Flex>
    );
  }

  // No game ID
  if (gameId === undefined) {
    return (
      <Flex className="game-body" align="center" justify="center">
        <VStack gap="4" textAlign="center" maxW="600px" p="10">
          <Heading
            fontSize="3rem"
            bgGradient="to-r"
            gradientFrom="#ffd54f"
            gradientTo="#ff6f00"
            bgClip="text"
          >
            Dusk and Dawn
          </Heading>
          <Box
            bg="rgba(255, 87, 34, 0.15)"
            border="1px solid #ff5722"
            color="#ffab91"
            p="3"
            borderRadius="lg"
            fontWeight="700"
          >
            No game ID found
          </Box>
          <ChakraLink
            asChild
            textDecoration="none"
            _hover={{ textDecoration: "none" }}
          >
            <Link to="/games">
              <Button bg="#ffd54f" color="#0b0906" fontWeight="700" size="lg">
                Back to Games
              </Button>
            </Link>
          </ChakraLink>
        </VStack>
      </Flex>
    );
  }

  // Player selection
  if (myPlayerType === null && !isSpectator) {
    return (
      <Flex className="game-body" align="center" justify="center">
        <VStack gap="4" textAlign="center" maxW="600px" p="10">
          <Heading
            fontSize="3rem"
            bgGradient="to-r"
            gradientFrom="#ffd54f"
            gradientTo="#ff6f00"
            bgClip="text"
          >
            Dusk and Dawn
          </Heading>
          <Text fontSize="1.5rem">Choose your side</Text>
          <HStack gap="4">
            <ChakraLink
              asChild
              textDecoration="none"
              _hover={{ textDecoration: "none" }}
            >
              <Link to={`?player=day`}>
                <Button
                  bg="#ffd54f"
                  color="#0b0906"
                  fontWeight="700"
                  size="lg"
                  boxShadow="0 4px 0 #b68c1d"
                  _hover={{ transform: "translateY(-2px)" }}
                >
                  Day Player
                </Button>
              </Link>
            </ChakraLink>
            <ChakraLink
              asChild
              textDecoration="none"
              _hover={{ textDecoration: "none" }}
            >
              <Link to={`?player=night`}>
                <Button
                  bg="#b39ddb"
                  color="#0b0906"
                  fontWeight="700"
                  size="lg"
                  boxShadow="0 4px 0 #664f91"
                  _hover={{ transform: "translateY(-2px)" }}
                >
                  Night Player
                </Button>
              </Link>
            </ChakraLink>
          </HStack>
          <Text color="rgba(255, 255, 255, 0.7)" mt="6">
            Share the other link with your opponent!
          </Text>
          <ChakraLink asChild color="rgba(255, 255, 255, 0.7)" mt="2">
            <Link to={`?player=spectator`}>Spectate</Link>
          </ChakraLink>
        </VStack>
      </Flex>
    );
  }

  // Main game view — canvas and sidebar keep their CSS classes for Board.ts DOM manipulation
  return (
    <div className="game-body">
      <div id="app">
        <div className="board">
          <div className="canvas-wrapper" ref={wrapperRef}>
            <canvas id="canvas" ref={canvasRef} width="600" height="600" />
          </div>
        </div>

        <aside className="sidebar">
          <section className="panel">
            <h2>Time</h2>
            <div id="time" className="time-display" />
            <div id="turn" className="turn-indicator" />
          </section>
          <section className="panel">
            <h2>Resources</h2>
            <div id="resources" className="stat-grid">
              <div>
                <img src="/img/wood.png" alt="wood" />
                <div id="wood" />
              </div>
              <div>
                <img src="/img/stone.png" alt="stone" />
                <div id="stone" />
              </div>
              <div>
                <img src="/img/food.png" alt="food" />
                <div id="food" />
              </div>
              <div>
                <img src="/img/gold.png" alt="gold" />
                <div id="gold" />
              </div>
            </div>
          </section>

          {ui !== null && gameRef.current !== null && (
            <BuildMenu game={gameRef.current} ui={ui} />
          )}
          {gameRef.current !== null && (
            <GameSettings game={gameRef.current} gameId={gameId} initialThemeId={activeThemeId} />
          )}
        </aside>
      </div>

      <div className="dialog-wrapper">
        <div className="dialog-content">
          <h1 id="dialog-title">Dialog</h1>
          <p id="dialog-text">This is a dialog</p>
          <button id="close-dialog">Close</button>
        </div>
      </div>
    </div>
  );
};
