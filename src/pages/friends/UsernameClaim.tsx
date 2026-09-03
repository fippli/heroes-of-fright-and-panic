import { useState, type FormEvent } from "react";
import { Button, Input, Text, VStack } from "@chakra-ui/react";
import { profilesApi, USERNAME_PATTERN, type Profile } from "../../lib/profiles";

/** One-time username claim, shown until the signed-in player has picked one */
export const UsernameClaim = ({ onClaimed }: { readonly onClaimed: (profile: Profile) => void }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalized = name.trim().toLowerCase();
  const valid = USERNAME_PATTERN.test(normalized);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setError("3–20 characters: lowercase letters, digits and _");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onClaimed(await profilesApi.claim(normalized));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <VStack gap="3" align="stretch">
        <Text color="brand.contrast" fontWeight="900" fontSize="1.2rem">
          Pick a username
        </Text>
        <Text color="brand.contrast">
          Friends invite you by this name instead of your email. It cannot be changed later.
        </Text>
        <Input
          placeholder="username"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          bg="white"
          color="brand.contrast"
          fontWeight="900"
          border="none"
        />
        {error !== null && <Text color="#b71c1c" fontWeight="700">{error}</Text>}
        <Button
          type="submit"
          disabled={busy || !valid}
          bg="brand.contrast"
          color="brand.solid"
          _hover={{ bg: "#3d3d3b" }}
        >
          {busy ? "Claiming…" : `Claim ${valid ? normalized : "username"}`}
        </Button>
      </VStack>
    </form>
  );
};
