import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../shared/api";
import { useAuth } from "../../shared/auth";

export function SigninApp() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/games", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.requestMagicLink(trimmedEmail);
      setLinkSentTo(trimmedEmail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1>Heroes of Fright and Panic</h1>
      <p>Sign in with a magic link</p>

      {error && (
        <div id="error" className="message message--error">
          {error}
        </div>
      )}

      {linkSentTo && (
        <div id="success" className="message message--success">
          <strong>Check your email!</strong>
          <br />
          We sent a magic link to <strong>{linkSentTo}</strong>.
          <br />
          <small className="text-muted">(In dev mode, check the server console)</small>
        </div>
      )}

      {!linkSentTo && (
        <form id="signin-form" onSubmit={handleSubmit}>
          <div>
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
          </div>
          <button type="submit" id="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Magic Link ✨"}
          </button>
        </form>
      )}

      <div>
        <Link to="/">← Back to home</Link>
      </div>
    </div>
  );
}
