import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";
import { useAdmin } from "../../lib/use-admin";

export const AdminPage = () => {
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <SplitLayout pageTitle="Admin">
        <p className="message message--error">
          You do not have admin access.
        </p>
        <Link to="/games" className="btn btn--secondary">
          Back to Games
        </Link>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout pageTitle="Admin">
      <nav className="main-menu__nav">
        <Link to="/admin/themes" className="btn btn--large">
          Themes
        </Link>
        <Link to="/admin/settings" className="btn btn--large">
          Settings
        </Link>
        <Link to="/games" className="btn btn--large btn--secondary">
          Back to Games
        </Link>
      </nav>
    </SplitLayout>
  );
};
