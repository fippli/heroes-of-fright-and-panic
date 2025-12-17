import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { gamesApi, type Game } from "../../shared/api";
import { useAuth } from "../../shared/auth";
import { formatDate } from "../../shared/dom";

interface CreateFormState {
  name: string;
  size: number;
  alliance: "day" | "night";
  inviteEmail: string;
}

export function GamesApp() {
  const navigate = useNavigate();
  const { user, requireAuth, logout: handleLogout } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CreateFormState>({
    name: "",
    size: 40,
    alliance: "day",
    inviteEmail: "",
  });

  const loadGames = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const data = await gamesApi.getAll();
      setGames(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load games";
      setPageError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        await requireAuth();
        if (ignore) return;
        await loadGames();
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : "Failed to load games";
        setPageError(message);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [loadGames, requireAuth]);

  const handleCreateGame = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalError(null);

    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      setModalError("Please enter a game name");
      return;
    }

    setIsCreating(true);
    try {
      const game = await gamesApi.create({
        name: trimmedName,
        size: formState.size,
        alliance: formState.alliance,
        inviteEmail: formState.inviteEmail.trim() || null,
      });
      setIsModalOpen(false);
      setFormState({ name: "", size: 40, alliance: "day", inviteEmail: "" });
      await loadGames();
      const newGameId = game.id || game._id;
      if (newGameId) {
        navigate(`/game/${newGameId}?player=${formState.alliance}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create game";
      setModalError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGame = useCallback(
    async (gameId: string) => {
      if (!window.confirm("Are you sure you want to delete this game?")) {
        return;
      }

      try {
        await gamesApi.delete(gameId);
        await loadGames();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete game";
        setPageError(message);
      }
    },
    [loadGames],
  );

  const modal = isModalOpen ? (
    <div className="modal">
      <div className="modal__overlay" onClick={() => setIsModalOpen(false)} />
      <div className="modal__content">
        <h3>Create New Game</h3>
        {modalError && <div className="message message--error">{modalError}</div>}
        <form id="create-form" onSubmit={handleCreateGame}>
          <div className="form-group">
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formState.name}
              onChange={(event) =>
                setFormState((current) => ({ ...current, name: event.target.value }))
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
                setFormState((current) => ({ ...current, size: Number(event.target.value) }))
              }
            >
              <option value="25">Small (25×25)</option>
              <option value="40">Medium (40×40)</option>
              <option value="55">Large (55×55)</option>
              <option value="70">Huge (70×70)</option>
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

          <div className="form-group">
            <label htmlFor="invite">Invite:</label>
            <input
              type="email"
              id="invite"
              name="invite"
              placeholder="email@example.com"
              value={formState.inviteEmail}
              onChange={(event) =>
                setFormState((current) => ({ ...current, inviteEmail: event.target.value }))
              }
            />
          </div>

          <div className="modal__actions">
            <button type="button" id="cancel-btn" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const renderGames = useMemo(() => {
    if (isLoading) {
      return <div>Loading games...</div>;
    }

    if (games.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state__icon" />
          <p>No games yet. Create one to get started!</p>
        </div>
      );
    }

    return games.map((game) => (
      <GameCard
        key={game.id || game._id}
        game={game}
        userEmail={user?.email || ""}
        onDelete={handleDeleteGame}
      />
    ));
  }, [games, handleDeleteGame, isLoading, user]);

  return (
    <>
      <header>
        <h1>Heroes of Fright and Panic</h1>
      </header>

      <main className="games-layout">
        <aside className="games-menu">
          <p id="user-email" className="user-email">
            {user?.email || ""}
          </p>
          {pageError && <div className="message message--error">{pageError}</div>}
          <button id="create-game-btn" onClick={() => setIsModalOpen(true)}>
            Create New Game
          </button>
          <button id="logout-btn" className="btn btn--secondary" onClick={() => handleLogout()}>
            Sign Out
          </button>
        </aside>

        <section className="games-content">
          <h2>My Games</h2>
          <div id="games-list">{renderGames}</div>
        </section>

        {modal}
      </main>
    </>
  );
}

interface GameCardProps {
  game: Game;
  userEmail: string;
  onDelete: (gameId: string) => void;
}

function GameCard({ game, userEmail, onDelete }: GameCardProps) {
  const gameId = game.id || game._id || "";
  const playerType: "day" | "night" | null =
    game.dayPlayerEmail === userEmail
      ? "day"
      : game.nightPlayerEmail === userEmail
        ? "night"
        : null;
  const isCreator = game.creatorEmail === userEmail;
  const turnClass = game.currentPlayer === "day" ? "turn-badge--day" : "turn-badge--night";
  const turnText = game.currentPlayer === "day" ? "Day" : "Night";

  const dayLastMove = game.dayPlayerLastMove ? formatDate(game.dayPlayerLastMove) : "No moves yet";
  const nightLastMove = game.nightPlayerLastMove ? formatDate(game.nightPlayerLastMove) : "No moves yet";

  return (
    <div className="game-card">
      <div className="game-card__info">
        <div className="game-card__header">
          <span>created: {formatDate(game.createdAt)}</span>
          <span>
            {game.size}×{game.size}
          </span>
          <span className="game-card__id">{gameId}</span>
        </div>

        <div className="game-card__players">
          <div className="game-card__player">
            <span className="game-card__player-label">day:</span>
            <span className="game-card__player-email">{game.dayPlayerEmail || "Not assigned"}</span>
            <span className="game-card__player-move">{dayLastMove}</span>
          </div>
          <div className="game-card__player">
            <span className="game-card__player-label">night:</span>
            <span className="game-card__player-email">{game.nightPlayerEmail || "Not assigned"}</span>
            <span className="game-card__player-move">{nightLastMove}</span>
          </div>
        </div>

        <div className="game-card__footer">
          <div className="game-card__turn">
            <span className={`turn-badge ${turnClass}`}>{turnText} player's turn</span>
          </div>
          <div className="game-card__actions">
            {playerType && (
              <Link to={`/game/${gameId}?player=${playerType}`} className="btn btn--small">
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
}
