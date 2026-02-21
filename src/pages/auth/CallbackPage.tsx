import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export const CallbackPage = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for errors in both hash (implicit flow) and query params (PKCE flow)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const authError =
          hashParams.get("error") ?? queryParams.get("error");
        const errorDescription =
          hashParams.get("error_description") ??
          queryParams.get("error_description");

        if (authError !== null) {
          setStatus("error");
          setErrorMessage(
            errorDescription ?? authError ?? "Authentication failed",
          );
          return;
        }

        // Supabase client auto-detects tokens from the URL hash
        const { error } = await supabase.auth.getSession();

        if (error !== null) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }

        setStatus("success");

        // Redirect to games page after short delay
        setTimeout(() => {
          navigate("/games");
        }, 1000);
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Authentication failed",
        );
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="container">
      <div className="card" style={{ textAlign: "center", maxWidth: "400px" }}>
        {status === "loading" && (
          <>
            <h2>Signing you in...</h2>
            <p style={{ color: "var(--text-muted)" }}>Please wait a moment.</p>
            <div
              style={{
                margin: "20px auto",
                width: "40px",
                height: "40px",
                border: "3px solid var(--border-color)",
                borderTopColor: "var(--accent-color)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {status === "success" && (
          <>
            <h2>Welcome back!</h2>
            <p style={{ color: "var(--text-muted)" }}>
              Redirecting you to your games...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h2>Authentication Failed</h2>
            <p style={{ color: "var(--error-color)" }}>{errorMessage}</p>
            <Link to="/signin" className="btn btn-primary">
              Try Again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
