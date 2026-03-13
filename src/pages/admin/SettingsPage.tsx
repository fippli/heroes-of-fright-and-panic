import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";
import { useAdmin } from "../../lib/use-admin";
import { supabase } from "../../lib/supabase";

type AdminUser = {
  readonly email: string;
};

export const SettingsPage = () => {
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<readonly AdminUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      supabase
        .from("admin_users")
        .select("email")
        .order("email")
        .then(({ data, error: fetchError }) => {
          if (fetchError !== null) {
            console.error("Failed to load admins:", fetchError);
            return;
          }
          setAdmins(data ?? []);
        });
    }
  }, [isLoading, isAdmin]);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (trimmedEmail === "") {
      setError("Please enter an email address");
      return;
    }

    setIsAdding(true);
    try {
      const { error: insertError } = await supabase
        .from("admin_users")
        .insert({ email: trimmedEmail });

      if (insertError !== null) {
        throw new Error(insertError.message);
      }

      setAdmins((current) =>
        [...current, { email: trimmedEmail }].toSorted((a, b) =>
          a.email.localeCompare(b.email),
        ),
      );
      setNewEmail("");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to add admin";
      setError(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (email === user?.email) {
      setError("You cannot remove yourself as admin");
      return;
    }

    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("admin_users")
        .delete()
        .eq("email", email);

      if (deleteError !== null) {
        throw new Error(deleteError.message);
      }

      setAdmins((current) => current.filter((admin) => admin.email !== email));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to remove admin";
      setError(message);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <SplitLayout pageTitle="Settings">
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
    <SplitLayout pageTitle="Settings">
      {error !== null && (
        <div className="message message--error">{error}</div>
      )}

      <h3>Admin Users</h3>

      <form onSubmit={handleAdd}>
        <div className="form-group">
          <label htmlFor="admin-email">Email:</label>
          <input
            type="email"
            id="admin-email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="email@example.com"
            required
          />
        </div>
        <div className="row">
          <button type="submit" disabled={isAdding}>
            {isAdding ? "Adding..." : "Add Admin"}
          </button>
        </div>
      </form>

      <div className="theme-list">
        {admins.map((admin) => (
          <div key={admin.email} className="theme-list__item">
            <div className="theme-list__info">
              <strong>{admin.email}</strong>
              {admin.email === user?.email && (
                <span className="text-muted"> (you)</span>
              )}
            </div>
            <div className="theme-list__actions">
              <button
                type="button"
                className="btn btn--small btn--secondary"
                onClick={() => handleRemove(admin.email)}
                disabled={admin.email === user?.email}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {admins.length === 0 && (
          <p className="text-muted">No admin users found.</p>
        )}
      </div>

      <div className="row" style={{ marginTop: "2rem" }}>
        <Link to="/admin" className="btn btn--secondary">
          Back to Admin
        </Link>
      </div>
    </SplitLayout>
  );
};
