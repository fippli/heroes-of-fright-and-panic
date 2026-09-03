import { useState, type FormEvent } from "react";
import { Box, Button, Flex, Heading, Input, Text, VStack } from "@chakra-ui/react";
import { profilesApi } from "../../lib/profiles";

/**
 * Small popup for sending a friend request by username or email.
 * Emails are resolved server-side; they never reach other clients.
 */
export const AddFriendDialog = ({
  open,
  onClose,
  onAdded,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onAdded?: (username: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed === "") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await profilesApi.request(trimmed);
      setMessage(
        outcome.status === "friends"
          ? `You and ${outcome.username} are now friends`
          : `Request sent to ${outcome.username} — you can already invite them by their username`,
      );
      setQuery("");
      onAdded?.(outcome.username);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex
      position="fixed"
      inset="0"
      bg="rgba(0, 0, 0, 0.55)"
      zIndex={30}
      align="center"
      justify="center"
      onClick={onClose}
    >
      <Box
        onClick={(event) => event.stopPropagation()}
        bg="rgba(247, 238, 216, 0.98)"
        border="3px solid"
        borderColor="border"
        borderRadius="14px"
        p="6"
        w="380px"
        maxW="90vw"
      >
        <form onSubmit={(event) => void handleSubmit(event)}>
          <VStack gap="3" align="stretch">
            <Heading as="h3" fontSize="1.3rem" color="fg">Add a friend</Heading>
            <Text color="brand.contrast" fontSize="0.95rem">
              Their username or the email they signed up with.
            </Text>
            <Input
              autoFocus
              placeholder="username or email@example.com"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              bg="white"
              color="brand.contrast"
              fontWeight="900"
              border="none"
            />
            {error !== null && <Text color="#b71c1c" fontWeight="700" fontSize="0.9rem">{error}</Text>}
            {message !== null && <Text color="brand.contrast" fontWeight="700" fontSize="0.9rem">{message}</Text>}
            <Flex gap="2" justify="flex-end">
              <Button
                type="button"
                variant="outline"
                borderColor="brand.contrast"
                color="brand.contrast"
                _hover={{ bg: "rgba(0, 0, 0, 0.1)" }}
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={busy || query.trim() === ""}
                bg="brand.contrast"
                color="brand.solid"
                _hover={{ bg: "#3d3d3b" }}
              >
                {busy ? "Sending…" : "Send request"}
              </Button>
            </Flex>
          </VStack>
        </form>
      </Box>
    </Flex>
  );
};
