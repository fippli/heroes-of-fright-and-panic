import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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
import { Banner } from "./Banner";
import { EventFeed } from "./EventFeed";
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
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState<GameUiState | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  // Side is decided by the server from the signed-in user, never by the URL
  const [role, setRole] = useState<"day" | "night" | null>(null);
  const [joinOffer, setJoinOffer] = useState<{ side: "day" | "night"; name: string | null } | null>(null);
  const [opponentOpen, setOpponentOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const joinGame = async (side: "day" | "night") => {
    setJoining(true);
    try {
      const { error: joinError } = await supabase.functions.invoke("game-join", { body: { gameId, side } });
      if (joinError !== null) throw new Error(await getEdgeFunctionError(joinError));
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the game");
      setJoining(false);
    }
  };

  const inviteLink = `${window.location.origin}/game/${gameId ?? ""}`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", inviteLink);
    }
  };

  useEffect(() => {
    if (canvasRef.current === null || wrapperRef.current === null || gameId === undefined) {
      return;
    }
    let myPlayerType: "day" | "night" | null = null;

    const canvasElement = canvasRef.current;
    const wrapperElement = wrapperRef.current;

    // Create canvas instance
    const canvas = new Canvas(canvasElement, wrapperElement);
    canvasInstanceRef.current = canvas;

    let uninstallErrorReporting = () => undefined as void;

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

        // Who am I in this game? A free seat is offered instead of a board.
        myPlayerType = data.viewingAs ?? null;
        if (myPlayerType === null && (data.canJoin === "day" || data.canJoin === "night")) {
          setJoinOffer({ side: data.canJoin, name: data.name ?? null });
          return;
        }
        setRole(myPlayerType);
        setOpponentOpen(data.opponentOpen === true);
        uninstallErrorReporting = installErrorReporting({ gameId, player: myPlayerType });

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
          e: () => game.setPendingTarget("enterTower"), // king selected → click tower
          n: (position) => game.trainPriest(position), // on church
          m: (position) => game.summonArchAngel(position), // on church
          g: () => game.setPendingTarget("heal"), // priest selected → click ally
          o: () => game.setPendingTarget("horse"), // house selected → click tile
          f: () => game.setPendingTarget("boat"), // house selected → click water
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
  }, [gameId]);

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

  // Offered a free seat
  if (joinOffer !== null) {
    return (
      <Flex className="game-body" align="center" justify="center">
        <VStack gap="4" textAlign="center" maxW="600px" p="10">
          <Heading fontSize="3rem" bgGradient="to-r" gradientFrom="#ffd54f" gradientTo="#ff6f00" bgClip="text">
            Dusk and Dawn
          </Heading>
          <Text fontSize="1.4rem">
            {joinOffer.name !== null ? `"${joinOffer.name}"` : "This game"} has a free seat on the{" "}
            <strong>{joinOffer.side}</strong> side.
          </Text>
          <Button
            bg={joinOffer.side === "day" ? "#ffd54f" : "#b39ddb"}
            color="#0b0906"
            fontWeight="700"
            size="lg"
            disabled={joining}
            onClick={() => void joinGame(joinOffer.side)}
          >
            {joining ? "Joining…" : `Join as ${joinOffer.side}`}
          </Button>
          <ChakraLink asChild color="rgba(255, 255, 255, 0.7)" mt="2">
            <Link to="/games">Back to games</Link>
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
          <Banner notice={ui?.notice ?? null} />
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
          {opponentOpen && (
            <section className="panel">
              <h2>Invite</h2>
              <p className="hint">The other seat is empty. Send this link — whoever opens it while signed in can take it.</p>
              <div className="invite">
                <input className="invite__link" readOnly value={inviteLink} onFocus={(event) => event.target.select()} />
                <button type="button" className="action-btn invite__copy" onClick={() => void copyInvite()}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </section>
          )}
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
            <EventFeed game={gameRef.current} gameId={gameId} player={role} />
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
