import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { gamesApi, type Game } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { formatDate } from "../../lib/dom";
import { SplitLayout } from "../../components/SplitLayout";

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
      return <div>Loading games...</div>;
    }

    if (games.length === 0) {
      return (
        <div className="empty-state">
          <p>No games yet. Create one to get started!</p>
        </div>
      );
    }

    return games.map((game) => (
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
      {pageError !== null && (
        <div className="message message--error">{pageError}</div>
      )}
      <div id="games-list">{renderGames}</div>
      <Link to="/games" className="back-link">
        Back to menu
      </Link>
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
  const turnClass =
    game.currentPlayer === "day" ? "turn-badge--day" : "turn-badge--night";
  const turnText = game.currentPlayer === "day" ? "Day" : "Night";

  const dayLastMove =
    game.dayPlayerLastMove != null
      ? formatDate(game.dayPlayerLastMove)
      : "No moves yet";
  const nightLastMove =
    game.nightPlayerLastMove != null
      ? formatDate(game.nightPlayerLastMove)
      : "No moves yet";

  return (
    <div className="game-card">
      <div className="game-card__info">
        <div className="game-card__header">
          <span>created: {formatDate(game.createdAt)}</span>
          <span>
            {game.size}x{game.size}
          </span>
          <span className="game-card__id">{gameId}</span>
        </div>

        <div className="game-card__players">
          <div className="game-card__player">
            <span className="game-card__player-label">day:</span>
            <span className="game-card__player-email">
              {game.dayPlayerEmail ?? "Not assigned"}
            </span>
            <span className="game-card__player-move">{dayLastMove}</span>
          </div>
          <div className="game-card__player">
            <span className="game-card__player-label">night:</span>
            <span className="game-card__player-email">
              {game.nightPlayerEmail ?? "Not assigned"}
            </span>
            <span className="game-card__player-move">{nightLastMove}</span>
          </div>
        </div>

        <div className="game-card__footer">
          <div className="game-card__turn">
            <span className={`turn-badge ${turnClass}`}>
              {turnText} player's turn
            </span>
          </div>
          <div className="game-card__actions">
            {playerType !== null && (
              <Link
                to={`/game/${gameId}?player=${playerType}`}
                className="btn btn--small"
              >
                Play
              </Link>
            )}
            {isCreator && (
              <button
                type="button"
                className="btn btn--small btn--delete"
                onClick={() => onDelete(gameId)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
