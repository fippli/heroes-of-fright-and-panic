import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../shared/supabase";

export const LandingPage = () => {
  const [isChecking, setIsChecking] = useState(true);
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
          setIsChecking(false);
        }
      })
      .catch(() => {
        setIsChecking(false);
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

  if (isChecking) {
    return null;
  }

  return (
    <div className="landing">
      <h1>Heroes of Fright and Panic</h1>

      {error !== null && (
        <div className="message message--error">{error}</div>
      )}

      {linkSentTo !== null ? (
        <div className="message message--success">
          <strong>Check your email!</strong>
          <br />
          We sent a magic link to <strong>{linkSentTo}</strong>.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
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
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send magic link"}
          </button>
        </form>
      )}
    </div>
  );
};
