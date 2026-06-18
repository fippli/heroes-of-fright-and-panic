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
import { ImageAssets, defaultImageAssets } from "../../images";
import { ThemeImageAssets } from "../../images/theme-image-assets";
import { supabase, getEdgeFunctionError } from "../../lib/supabase";
import type { Coordinate } from "../../types/coordinate";
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

    // Render loop
    const startRenderLoop = (game: Game) => {
      const loop = () => {
        if (canvas.ctx === null) {
          return;
        }

        canvas.init();
        game.render();
        canvas.reset();

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

        // Load theme assets if the game has a theme
        const themeId = data.themeId ?? data.theme_id ?? null;
        const imageAssets =
          themeId !== null
            ? new ImageAssets(await ThemeImageAssets.fromThemeId(themeId))
            : defaultImageAssets;

        const game = new Game(canvas, myPlayerType, imageAssets);
        gameRef.current = game;

        game.parse(data);
        console.log("Game loaded:", game.id, "Playing as:", myPlayerType);
        startRenderLoop(game);

        // Input handlers
        canvas.click((position: Coordinate) => game.click(position));

        canvas.keydown({
          // Build actions
          h: (position) => game.build(BuildingType.house, position),
          t: (position) => game.build(BuildingType.tower, position),
          c: (position) => game.build(BuildingType.castle, position),
          w: (position) => game.build(BuildingType.wall, position),
          r: (position) => game.build(BuildingType.church, position),

          // Unit actions
          p: (position) => game.spawnPeasant(position),
          s: (position) => game.craftEquipment(EquipmentType.sword, position),
          d: (position) => game.craftEquipment(EquipmentType.shield, position),
          b: (position) => game.craftEquipment(EquipmentType.bow, position),
          x: (position) => game.attack(position),
        });
      })
      .catch((err) => {
        console.error("Error loading game:", err);
        setError(err instanceof Error ? err.message : "Failed to load game");
      });

    // Cleanup on unmount
    return () => {
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
            Heroes of Fright and Panic
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
            Heroes of Fright and Panic
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
            Heroes of Fright and Panic
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

          <section className="panel">
            <h2>Buildings</h2>
            <div id="buildings" className="stat-grid">
              <div>
                <img src="/img/house.png" alt="buildings" />
                <div id="houses" />
              </div>
              <div>
                <img src="/img/tower.png" alt="buildings" />
                <div id="towers" />
              </div>
              <div>
                <img src="/img/castle.png" alt="buildings" />
                <div id="castles" />
              </div>
            </div>
          </section>
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
