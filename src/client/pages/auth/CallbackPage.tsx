import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../shared/supabase";

export const CallbackPage = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in hash (Supabase error format)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const hashError = params.get("error");
        const errorDescription = params.get("error_description");

        if (hashError !== null) {
          setStatus("error");
          setErrorMessage(
            errorDescription ?? hashError ?? "Authentication failed",
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
