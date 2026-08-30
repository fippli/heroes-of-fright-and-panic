import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
  Badge,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { gamesApi, type Game } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { formatDate } from "../../lib/dom";
import { SplitLayout } from "../../components/SplitLayout";
import { ErrorBox } from "../../components/ErrorBox";

type AuthUser = {
  id: string;
  email: string;
};

export const LoadGamesPage = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadGames = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const data = await gamesApi.getAll();
      setGames(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load games";
      setPageError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (controller.signal.aborted) return;

      if (
        error !== null ||
        data.user === null ||
        data.user.email === undefined
      ) {
        navigate("/signin");
        return;
      }

      setUser({ id: data.user.id, email: data.user.email });
      setIsCheckingAuth(false);
      await loadGames();
    })();

    return () => {
      controller.abort();
    };
  }, [loadGames, navigate]);

  const handleDeleteGame = useCallback(
    async (gameId: string) => {
      if (!window.confirm("Are you sure you want to delete this game?")) {
        return;
      }

      try {
        await gamesApi.delete(gameId);
        await loadGames();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete game";
        setPageError(message);
      }
    },
    [loadGames],
  );

  const renderGames = useMemo(() => {
    if (isLoading) {
      return <Text color="brand.contrast">Loading games...</Text>;
    }

    if (games.length === 0) {
      return (
        <Text color="brand.contrast" textAlign="center" py="12">
          No games yet. Create one to get started!
        </Text>
      );
    }

    const email = user?.email ?? "";
    const rank = (game: Game): number => {
      if (game.gameOver === true) return 2;
      const mine = game.dayPlayerEmail === email ? "day" : game.nightPlayerEmail === email ? "night" : null;
      return mine !== null && mine === game.currentPlayer ? 0 : 1;
    };
    return [...games].sort((a, b) => rank(a) - rank(b)).map((game) => (
      <GameCard
        key={game.id ?? game._id}
        game={game}
        userEmail={user?.email ?? ""}
        onDelete={handleDeleteGame}
      />
    ));
  }, [games, handleDeleteGame, isLoading, user]);

  if (isCheckingAuth) {
    return null;
  }

  return (
    <SplitLayout pageTitle="My Games">
      {pageError !== null && <ErrorBox>{pageError}</ErrorBox>}
      <VStack gap="4" align="stretch">
        {renderGames}
      </VStack>
      <ChakraLink asChild color="brand.contrast" textDecoration="underline" _hover={{ color: "#3d3d3b" }}>
        <Link to="/games">Back to menu</Link>
      </ChakraLink>
    </SplitLayout>
  );
};

type GameCardProps = {
  game: Game;
  userEmail: string;
  onDelete: (gameId: string) => void;
};

const GameCard = ({ game, userEmail, onDelete }: GameCardProps) => {
  const gameId = game.id ?? game._id ?? "";
  const playerType: "day" | "night" | null =
    game.dayPlayerEmail === userEmail
      ? "day"
      : game.nightPlayerEmail === userEmail
        ? "night"
        : null;
  const isCreator = game.creatorEmail === userEmail;
  const isMyTurn = playerType !== null && playerType === game.currentPlayer;
  const status =
    game.gameOver === true
      ? `Finished — ${game.winner === "day" ? "Day" : game.winner === "night" ? "Night" : "nobody"} won`
      : playerType === null
        ? `${game.currentPlayer === "day" ? "Day" : "Night"}'s turn`
        : isMyTurn
          ? "Your turn"
          : "Waiting for opponent";
  const statusBg = game.gameOver === true ? "rgba(0,0,0,0.3)" : isMyTurn ? "#9ccc65" : game.currentPlayer === "day" ? "day.500" : "night.500";

  const dayLastMove =
    game.dayPlayerLastMove != null
      ? formatDate(game.dayPlayerLastMove)
      : "No moves yet";
  const nightLastMove =
    game.nightPlayerLastMove != null
      ? formatDate(game.nightPlayerLastMove)
      : "No moves yet";

  return (
    <Box
      border="2px solid"
      borderColor="brand.contrast"
      borderRadius="md"
      p="4"
      bg="rgba(0, 0, 0, 0.1)"
    >
      <VStack gap="2" align="stretch">
        <HStack gap="3" flexWrap="wrap">
          <Text fontWeight="900" color="brand.contrast" fontSize="md">
            {game.name ?? "Untitled game"}
          </Text>
          <Text fontWeight="700" color="brand.contrast" fontSize="sm">
            created: {formatDate(game.createdAt)}
          </Text>
          <Text fontWeight="700" color="brand.contrast" fontSize="sm">
            {game.size}x{game.size}
          </Text>
          <Text fontWeight="700" color="brand.contrast" fontSize="xs" opacity={0.7}>
            {gameId}
          </Text>
        </HStack>

        <VStack gap="1" align="stretch">
          <HStack gap="2">
            <Text fontWeight="700" color="brand.contrast" minW="50px" fontSize="sm">day:</Text>
            <Text color="brand.contrast" flex="1" fontSize="sm">{game.dayPlayerEmail ?? "Not assigned"}</Text>
            <Text color="brand.contrast" fontSize="xs">{dayLastMove}</Text>
          </HStack>
          <HStack gap="2">
            <Text fontWeight="700" color="brand.contrast" minW="50px" fontSize="sm">night:</Text>
            <Text color="brand.contrast" flex="1" fontSize="sm">{game.nightPlayerEmail ?? "Not assigned"}</Text>
            <Text color="brand.contrast" fontSize="xs">{nightLastMove}</Text>
          </HStack>
        </VStack>

        <Flex justify="space-between" align="center" mt="1">
          <Badge
            bg={statusBg}
            color={isMyTurn || game.currentPlayer === "day" ? "brand.contrast" : "white"}
            px="2"
            py="1"
            borderRadius="sm"
            fontWeight="900"
            fontSize="xs"
          >
            {status}
          </Badge>
          <HStack gap="2">
            <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
              <Link to={`/game/${gameId}`}>
                <Button size="sm" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
                  {playerType !== null ? "Play" : "Open"}
                </Button>
              </Link>
            </ChakraLink>
            {isCreator && (
              <Button
                size="sm"
                bg="danger.500"
                color="white"
                _hover={{ bg: "danger.600" }}
                onClick={() => onDelete(gameId)}
              >
                Delete
              </Button>
            )}
          </HStack>
        </Flex>
      </VStack>
    </Box>
  );
};
