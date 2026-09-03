import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { supabase } from "../../lib/supabase";
import { profilesApi, type FriendEntry, type Profile } from "../../lib/profiles";
import { SplitLayout } from "../../components/SplitLayout";
import { UsernameClaim } from "./UsernameClaim";

const Row = ({ children }: { readonly children: React.ReactNode }) => (
  <Flex
    align="center"
    justify="space-between"
    border="2px solid"
    borderColor="brand.contrast"
    borderRadius="md"
    px="3"
    py="2"
    bg="rgba(0, 0, 0, 0.1)"
  >
    {children}
  </Flex>
);

const SmallButton = (props: React.ComponentProps<typeof Button>) => (
  <Button
    size="sm"
    bg="brand.contrast"
    color="brand.solid"
    _hover={{ bg: "#3d3d3b" }}
    {...props}
  />
);

export const FriendsPage = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checked, setChecked] = useState(false);
  const [friends, setFriends] = useState<readonly FriendEntry[]>([]);
  const [addName, setAddName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const reload = useCallback(async () => {
    setFriends(await profilesApi.friends());
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user === null) {
        navigate("/signin");
        return;
      }
      try {
        const own = await profilesApi.getOwn();
        setProfile(own);
        if (own !== null) await reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
      setChecked(true);
    })();
  }, [navigate, reload]);

  const act = async (work: () => Promise<void>) => {
    setError(null);
    setMessage(null);
    try {
      await work();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const name = addName.trim();
    if (name === "") return;
    await act(async () => {
      const outcome = await profilesApi.sendRequest(name);
      setMessage(
        outcome === "friends"
          ? `You and ${name.toLowerCase()} are now friends`
          : `Request sent to ${name.toLowerCase()}`,
      );
      setAddName("");
    });
  };

  if (!checked) return null;

  if (profile === null) {
    return (
      <SplitLayout pageTitle="Friends">
        <UsernameClaim onClaimed={(claimed) => { setProfile(claimed); void reload(); }} />
      </SplitLayout>
    );
  }

  const received = friends.filter((entry) => entry.status === "received");
  const sent = friends.filter((entry) => entry.status === "sent");
  const accepted = friends.filter((entry) => entry.status === "friends");

  return (
    <SplitLayout pageTitle="Friends">
      <VStack gap="5" align="stretch">
        <Text color="brand.contrast" fontWeight="700">
          You play as <Text as="span" fontWeight="900">{profile.username}</Text> — friends add you with this name.
        </Text>

        <form onSubmit={(event) => void handleAdd(event)}>
          <HStack gap="2">
            <Input
              placeholder="friend's username"
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              bg="white"
              color="brand.contrast"
              fontWeight="900"
              border="none"
            />
            <SmallButton type="submit" size="md">Add friend</SmallButton>
          </HStack>
        </form>

        {error !== null && <Text color="#b71c1c" fontWeight="700">{error}</Text>}
        {message !== null && <Text color="brand.contrast" fontWeight="700">{message}</Text>}

        {received.length > 0 && (
          <VStack gap="2" align="stretch">
            <Text color="brand.contrast" fontWeight="900">Requests for you</Text>
            {received.map((entry) => (
              <Row key={entry.userId}>
                <Text color="brand.contrast" fontWeight="700">{entry.username}</Text>
                <HStack gap="2">
                  <SmallButton onClick={() => void act(() => profilesApi.accept(entry.userId))}>Accept</SmallButton>
                  <SmallButton variant="outline" bg="transparent" color="brand.contrast" borderColor="brand.contrast" onClick={() => void act(() => profilesApi.remove(entry.userId))}>
                    Decline
                  </SmallButton>
                </HStack>
              </Row>
            ))}
          </VStack>
        )}

        {sent.length > 0 && (
          <VStack gap="2" align="stretch">
            <Text color="brand.contrast" fontWeight="900">Waiting on them</Text>
            {sent.map((entry) => (
              <Row key={entry.userId}>
                <Text color="brand.contrast" fontWeight="700">{entry.username}</Text>
                <SmallButton variant="outline" bg="transparent" color="brand.contrast" borderColor="brand.contrast" onClick={() => void act(() => profilesApi.remove(entry.userId))}>
                  Cancel
                </SmallButton>
              </Row>
            ))}
          </VStack>
        )}

        <VStack gap="2" align="stretch">
          <Text color="brand.contrast" fontWeight="900">Friends</Text>
          {accepted.length === 0 && (
            <Text color="brand.contrast" opacity={0.8}>
              No friends yet — send a request above, or have a friend add {profile.username}.
            </Text>
          )}
          {accepted.map((entry) => (
            <Row key={entry.userId}>
              <Text color="brand.contrast" fontWeight="700">{entry.username}</Text>
              <SmallButton variant="outline" bg="transparent" color="brand.contrast" borderColor="brand.contrast" onClick={() => void act(() => profilesApi.remove(entry.userId))}>
                Remove
              </SmallButton>
            </Row>
          ))}
        </VStack>

        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
          <Link to="/games">
            <Box textAlign="center" color="brand.contrast" fontWeight="700">← Back to games</Box>
          </Link>
        </ChakraLink>
      </VStack>
    </SplitLayout>
  );
};
