import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../shared/api";
import { useAuth } from "../../shared/auth";

export function LandingApp() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/games", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessEmail(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.requestMagicLink(trimmedEmail);
      setSuccessEmail(trimmedEmail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header>
        <h1>Heroes of Fright and Panic</h1>
      </header>

      <main>
        <form id="signin-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
          />

          <button type="submit" id="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Magic Link"}
          </button>
        </form>

        {error && (
          <div id="error" className="message message--error">
            {error}
          </div>
        )}

        {successEmail && (
          <div id="success" className="message message--success">
            <strong>Check your email!</strong>
            <br />
            We sent a magic link to <strong>{successEmail}</strong>.
            <br />
            <small>(In dev mode, check the server console)</small>
          </div>
        )}
      </main>
    </>
  );
}
