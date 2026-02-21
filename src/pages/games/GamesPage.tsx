import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type AuthUser = {
  id: string;
  email: string;
};

export const GamesPage = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

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
    })();

    return () => {
      controller.abort();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (logoutError) {
      console.error("Logout failed:", logoutError);
    }
    navigate("/");
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <div className="main-menu">
      <header className="main-menu__header">
        <h1>Heroes of Fright and Panic</h1>
        <span className="main-menu__user">{user?.email ?? ""}</span>
      </header>

      <nav className="main-menu__nav">
        <Link to="/games/new" className="btn btn--large">
          New Game
        </Link>
        <Link to="/games/list" className="btn btn--large">
          Load Game
        </Link>
        <Link to="/about" className="btn btn--large">
          About
        </Link>
        <button
          type="button"
          className="btn btn--large btn--secondary"
          onClick={() => handleLogout()}
        >
          Sign Out
        </button>
      </nav>
    </div>
  );
};
