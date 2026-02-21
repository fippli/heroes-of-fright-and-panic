import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export const SigninPage = () => {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user !== null) {
          navigate("/games");
        } else {
          setIsCheckingAuth(false);
        }
      })
      .catch(() => {
        setIsCheckingAuth(false);
      });
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (trimmedEmail === "") {
      setError("Please enter your email address");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError !== null) {
        setError(otpError.message);
        return;
      }

      setLinkSentTo(trimmedEmail);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show nothing while checking auth status
  if (isCheckingAuth) {
    return null;
  }

  return (
    <div className="page-with-hero">
      <header>
        <h1>Heroes of Fright and Panic</h1>
      </header>

      <main>
        <p className="tagline">Sign in with a magic link</p>

        {error !== null && (
          <div id="error" className="message message--error">
            {error}
          </div>
        )}

        {linkSentTo !== null ? (
          <div id="success" className="message message--success">
            <strong>Check your email!</strong>
            <br />
            We sent a magic link to <strong>{linkSentTo}</strong>.
            <br />
            <small className="text-muted">
              (In dev mode, check the server console)
            </small>
          </div>
        ) : (
          <form id="signin-form" onSubmit={handleSubmit}>
            <div className="form-group">
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
              {isSubmitting ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        )}

        <Link to="/" className="back-link">
          Back to home
        </Link>
      </main>
    </div>
  );
}
