import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";

export const CallbackPage = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
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

        const { error } = await supabase.auth.getSession();

        if (error !== null) {
          setStatus("error");
          setErrorMessage(error.message);
          return;
        }

        setStatus("success");

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
    <SplitLayout pageTitle="Signing In">
      {status === "loading" && <p>Please wait a moment...</p>}

      {status === "success" && <p>Welcome back! Redirecting to your games...</p>}

      {status === "error" && (
        <>
          <div className="message message--error">{errorMessage}</div>
          <Link to="/signin" className="btn">
            Try Again
          </Link>
        </>
      )}
    </SplitLayout>
  );
};
