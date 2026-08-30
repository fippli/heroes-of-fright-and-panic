import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
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
import { supabase } from "../../lib/supabase";

type AdminUser = {
  readonly email: string;
};

export const SettingsPage = () => {
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<readonly AdminUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      supabase
        .from("admin_users")
        .select("email")
        .order("email")
        .then(({ data, error: fetchError }) => {
          if (fetchError !== null) {
            console.error("Failed to load admins:", fetchError);
            return;
          }
          setAdmins(data ?? []);
        });
    }
  }, [isLoading, isAdmin]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (trimmedEmail === "") {
      setError("Please enter an email address");
      return;
    }

    setIsAdding(true);
    try {
      const { error: insertError } = await supabase
        .from("admin_users")
        .insert({ email: trimmedEmail });

      if (insertError !== null) {
        throw new Error(insertError.message);
      }

      setAdmins((current) =>
        [...current, { email: trimmedEmail }].toSorted((adminA, adminB) =>
          adminA.email.localeCompare(adminB.email),
        ),
      );
      setNewEmail("");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to add admin";
      setError(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (email === user?.email) {
      setError("You cannot remove yourself as admin");
      return;
    }

    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("admin_users")
        .delete()
        .eq("email", email);

      if (deleteError !== null) {
        throw new Error(deleteError.message);
      }

      setAdmins((current) => current.filter((admin) => admin.email !== email));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Failed to remove admin";
      setError(message);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return (
      <SplitLayout pageTitle="Settings">
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
    <SplitLayout pageTitle="Settings">
      {error !== null && <ErrorBox>{error}</ErrorBox>}

      <Heading as="h3" fontSize="1.25rem" color="brand.contrast">Admin Users</Heading>

      <VStack as="form" onSubmit={handleAdd} gap="4" align="stretch">
        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Email</Field.Label>
          <Input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="email@example.com"
            required
            bg="white"
            color="brand.contrast"
            fontWeight="900"
            border="none"
          />
        </Field.Root>
        <Button
          type="submit"
          disabled={isAdding}
          bg="brand.contrast"
          color="brand.solid"
          _hover={{ bg: "#3d3d3b" }}
        >
          {isAdding ? "Adding..." : "Add Admin"}
        </Button>
      </VStack>

      <VStack gap="2" align="stretch">
        {admins.map((admin) => (
          <Flex
            key={admin.email}
            justify="space-between"
            align="center"
            p="3"
            border="1px solid"
            borderColor="brand.contrast"
            borderRadius="md"
          >
            <Text fontWeight="700" color="brand.contrast" fontSize="sm">
              {admin.email}
              {admin.email === user?.email && (
                <Text as="span" opacity={0.6}> (you)</Text>
              )}
            </Text>
            <Button
              size="sm"
              variant="outline"
              borderColor="brand.contrast"
              color="brand.contrast"
              _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}
              onClick={() => handleRemove(admin.email)}
              disabled={admin.email === user?.email}
            >
              Remove
            </Button>
          </Flex>
        ))}
        {admins.length === 0 && (
          <Text color="brand.contrast" opacity={0.6}>No admin users found.</Text>
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
