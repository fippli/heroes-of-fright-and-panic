import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Input, VStack, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Field } from "@chakra-ui/react";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";

export const SignupPage = () => {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (trimmedEmail === "") {
      setError("Please enter your email address");
      return;
    }

    if (password === "") {
      setError("Please enter your password");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (authError !== null) {
        setError(authError.message);
        return;
      }

      navigate("/games");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <SplitLayout pageTitle="Sign Up">
      {error !== null && (
        <Box bg="rgba(220, 53, 69, 0.2)" color="#8b0000" border="2px solid" borderColor="danger.500" p="4" borderRadius="md" fontWeight="bold">
          {error}
        </Box>
      )}

      <VStack as="form" onSubmit={handleSubmit} gap="4" align="stretch">
        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Email address</Field.Label>
          <Input
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            bg="white"
            color="brand.contrast"
            fontWeight="900"
            border="none"
          />
        </Field.Root>

        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">Password</Field.Label>
          <Input
            type="password"
            placeholder="Choose a password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            bg="white"
            color="brand.contrast"
            fontWeight="900"
            border="none"
          />
        </Field.Root>

        <Button
          type="submit"
          disabled={isSubmitting}
          bg="brand.contrast"
          color="brand.solid"
          fontWeight="bold"
          _hover={{ bg: "#3d3d3b" }}
        >
          {isSubmitting ? "Loading..." : "Sign Up"}
        </Button>
      </VStack>

      <ChakraLink asChild color="brand.contrast" textDecoration="underline" _hover={{ color: "#3d3d3b" }}>
        <Link to="/signin">Sign in</Link>
      </ChakraLink>
    </SplitLayout>
  );
};
