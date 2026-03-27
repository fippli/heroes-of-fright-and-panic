import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, VStack, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useAdmin } from "../../lib/use-admin";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";

type AuthUser = {
  id: string;
  email: string;
};

export const GamesPage = () => {
  const [_user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (controller.signal.aborted) return;

      if (
        error !== null ||
        data.user === null ||
        data.user.email === undefined
      ) {
        navigate("/signin");
        return;
      }

      setUser({ id: data.user.id, email: data.user.email });
      setIsCheckingAuth(false);
    })();

    return () => {
      controller.abort();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (logoutError) {
      console.error("Logout failed:", logoutError);
    }
    navigate("/");
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <SplitLayout pageTitle="Games">
      <VStack gap="4" w="100%" align="stretch">
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/games/new">
            <Button w="100%" size="lg" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
              New Game
            </Button>
          </Link>
        </ChakraLink>
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/games/list">
            <Button w="100%" size="lg" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
              Load Game
            </Button>
          </Link>
        </ChakraLink>
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/about">
            <Button w="100%" size="lg" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
              About
            </Button>
          </Link>
        </ChakraLink>
        {isAdmin && (
          <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
            <Link to="/admin">
              <Button w="100%" size="lg" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
                Admin
              </Button>
            </Link>
          </ChakraLink>
        )}
        <Button
          size="lg"
          variant="outline"
          borderColor="brand.contrast"
          color="brand.contrast"
          _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}
          onClick={() => handleLogout()}
        >
          Sign Out
        </Button>
      </VStack>
    </SplitLayout>
  );
};
