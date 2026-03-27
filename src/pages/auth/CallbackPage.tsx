import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Text, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";
import { ErrorBox } from "../../components/ErrorBox";

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
      {status === "loading" && <Text color="brand.contrast">Please wait a moment...</Text>}

      {status === "success" && <Text color="brand.contrast">Welcome back! Redirecting to your games...</Text>}

      {status === "error" && (
        <>
          <ErrorBox>{errorMessage}</ErrorBox>
          <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
            <Link to="/signin">
              <Button bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
                Try Again
              </Button>
            </Link>
          </ChakraLink>
        </>
      )}
    </SplitLayout>
  );
};
