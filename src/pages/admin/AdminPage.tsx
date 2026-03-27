import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, VStack, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";
import { ErrorBox } from "../../components/ErrorBox";
import { useAdmin } from "../../lib/use-admin";

export const AdminPage = () => {
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <SplitLayout pageTitle="Admin">
        <ErrorBox>You do not have admin access.</ErrorBox>
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/games">
            <Button variant="outline" borderColor="brand.contrast" color="brand.contrast" _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}>
              Back to Games
            </Button>
          </Link>
        </ChakraLink>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout pageTitle="Admin">
      <VStack gap="4" w="100%" align="stretch">
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/admin/themes">
            <Button w="100%" size="lg" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
              Themes
            </Button>
          </Link>
        </ChakraLink>
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/admin/settings">
            <Button w="100%" size="lg" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
              Settings
            </Button>
          </Link>
        </ChakraLink>
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/games">
            <Button w="100%" size="lg" variant="outline" borderColor="brand.contrast" color="brand.contrast" _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}>
              Back to Games
            </Button>
          </Link>
        </ChakraLink>
      </VStack>
    </SplitLayout>
  );
};
