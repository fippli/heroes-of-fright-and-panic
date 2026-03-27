import { type FormEvent, useState } from "react";
import { Box, Button, Input, VStack, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Field } from "@chakra-ui/react";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

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
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (resetError !== null) {
        setError(resetError.message);
        return;
      }

      setEmailSent(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SplitLayout pageTitle="Forgot Password">
      {error !== null && (
        <Box bg="rgba(220, 53, 69, 0.2)" color="#8b0000" border="2px solid" borderColor="danger.500" p="4" borderRadius="md" fontWeight="bold">
          {error}
        </Box>
      )}

      {emailSent ? (
        <Box bg="rgba(40, 167, 69, 0.2)" color="#006400" border="2px solid" borderColor="success.500" p="4" borderRadius="md" fontWeight="bold">
          Check your email for a password reset link.
        </Box>
      ) : (
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

          <Button
            type="submit"
            disabled={isSubmitting}
            bg="brand.contrast"
            color="brand.solid"
            fontWeight="bold"
            _hover={{ bg: "#3d3d3b" }}
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </VStack>
      )}

      <ChakraLink asChild color="brand.contrast" textDecoration="underline" _hover={{ color: "#3d3d3b" }}>
        <Link to="/signin">Sign in</Link>
      </ChakraLink>
    </SplitLayout>
  );
};
