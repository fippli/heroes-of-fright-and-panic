import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Field } from "@chakra-ui/react";
import { SplitLayout } from "../../components/SplitLayout";
import { ErrorBox } from "../../components/ErrorBox";
import { useAdmin } from "../../lib/use-admin";
import { themesApi, type Theme } from "../../lib/theme-api";

export const ThemesPage = () => {
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [themes, setThemes] = useState<readonly Theme[]>([]);
  const [themeName, setThemeName] = useState("");
  const [themeDescription, setThemeDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      themesApi.getAll().then(setThemes).catch(console.error);
    }
  }, [isLoading, isAdmin]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = themeName.trim();
    if (trimmedName === "") {
      setError("Please enter a theme name");
      return;
    }

    setIsCreating(true);
    try {
      const newTheme = await themesApi.create({
        name: trimmedName,
        description: themeDescription.trim(),
      });
      setThemes((current) => [newTheme, ...current]);
      setThemeName("");
      setThemeDescription("");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to create theme";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (themeId: string) => {
    try {
      await themesApi.delete(themeId);
      setThemes((current) => current.filter((theme) => theme.id !== themeId));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to delete theme";
      setError(message);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <SplitLayout pageTitle="Themes">
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
    <SplitLayout pageTitle="Themes">
      {error !== null && <ErrorBox>{error}</ErrorBox>}

      <VStack as="form" onSubmit={handleCreate} gap="4" align="stretch">
        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Name</Field.Label>
          <Input
            type="text"
            value={themeName}
            onChange={(event) => setThemeName(event.target.value)}
            required
            bg="white"
            color="brand.contrast"
            fontWeight="900"
            border="none"
          />
        </Field.Root>
        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Description</Field.Label>
          <Input
            type="text"
            value={themeDescription}
            onChange={(event) => setThemeDescription(event.target.value)}
            bg="white"
            color="brand.contrast"
            fontWeight="900"
            border="none"
          />
        </Field.Root>
        <Button
          type="submit"
          disabled={isCreating}
          bg="brand.contrast"
          color="brand.solid"
          _hover={{ bg: "#3d3d3b" }}
        >
          {isCreating ? "Creating..." : "Create Theme"}
        </Button>
      </VStack>

      <VStack gap="2" align="stretch">
        {themes.map((theme) => (
          <Flex
            key={theme.id}
            justify="space-between"
            align="center"
            p="3"
            border="1px solid"
            borderColor="brand.contrast"
            borderRadius="md"
          >
            <Box>
              <Text fontWeight="700" color="brand.contrast" fontSize="sm">
                {theme.name}
              </Text>
              {theme.description !== null && theme.description !== "" && (
                <Text color="brand.contrast" opacity={0.6} fontSize="xs">
                  {theme.description}
                </Text>
              )}
            </Box>
            <HStack gap="2">
              <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
                <Link to={`/admin/themes/${theme.id}`}>
                  <Button size="sm" bg="brand.contrast" color="brand.solid" _hover={{ bg: "#3d3d3b" }}>
                    Edit
                  </Button>
                </Link>
              </ChakraLink>
              <Button
                size="sm"
                variant="outline"
                borderColor="brand.contrast"
                color="brand.contrast"
                _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}
                onClick={() => handleDelete(theme.id)}
              >
                Delete
              </Button>
            </HStack>
          </Flex>
        ))}
        {themes.length === 0 && (
          <Text color="brand.contrast" opacity={0.6}>No themes yet. Create one above.</Text>
        )}
      </VStack>

      <Box mt="8">
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/admin">
            <Button variant="outline" borderColor="brand.contrast" color="brand.contrast" _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}>
              Back to Admin
            </Button>
          </Link>
        </ChakraLink>
      </Box>
    </SplitLayout>
  );
};
