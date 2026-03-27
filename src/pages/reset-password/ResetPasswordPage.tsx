import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Input, VStack } from "@chakra-ui/react";
import { Field } from "@chakra-ui/react";
import { supabase } from "../../lib/supabase";
import { SplitLayout } from "../../components/SplitLayout";

export const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password === "") {
      setError("Please enter a new password");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError !== null) {
        setError(updateError.message);
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

  return (
    <SplitLayout pageTitle="Reset Password">
      {error !== null && (
        <Box bg="rgba(220, 53, 69, 0.2)" color="#8b0000" border="2px solid" borderColor="danger.500" p="4" borderRadius="md" fontWeight="bold">
          {error}
        </Box>
      )}

      <VStack as="form" onSubmit={handleSubmit} gap="4" align="stretch">
        <Field.Root>
          <Field.Label color="brand.contrast" fontWeight="700" fontSize="1.2rem">New password</Field.Label>
          <Input
            type="password"
            placeholder="Choose a new password"
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
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </VStack>
    </SplitLayout>
  );
};
