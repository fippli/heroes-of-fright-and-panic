import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { supabase } from "../../lib/supabase";
import {
  factionsApi,
  defaultTierName,
  FACTION_TIERS,
  type Faction,
  type FactionPieces,
  type FactionType,
} from "../../lib/factions";
import { SplitLayout } from "../../components/SplitLayout";
import { ErrorBox } from "../../components/ErrorBox";

const SmallButton = (props: React.ComponentProps<typeof Button>) => (
  <Button
    size="sm"
    bg="brand.contrast"
    color="brand.solid"
    _hover={{ bg: "#3d3d3b" }}
    {...props}
  />
);

/** One tier row: default name, the faction's own name, and its image */
const TierRow = ({
  faction,
  kind,
  tier,
  onSaved,
  onError,
}: {
  readonly faction: Faction;
  readonly kind: string;
  readonly tier: number;
  readonly onSaved: (updated: Faction) => void;
  readonly onError: (message: string) => void;
}) => {
  const piece = faction.pieces[kind] ?? {};
  const [name, setName] = useState(piece.name ?? "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fallback = defaultTierName(kind, faction.type);

  const savePieces = async (pieces: FactionPieces): Promise<void> => {
    setBusy(true);
    try {
      onSaved(await factionsApi.update(faction.id, { pieces }));
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed === (piece.name ?? "")) return;
    await savePieces({
      ...faction.pieces,
      [kind]: { ...piece, name: trimmed === "" ? undefined : trimmed },
    });
  };

  const uploadImage = async (file: File): Promise<void> => {
    setBusy(true);
    try {
      const imagePath = await factionsApi.uploadPieceImage(faction.id, kind, file);
      await savePieces({ ...faction.pieces, [kind]: { ...piece, name: piece.name, imagePath } });
    } catch (uploadError) {
      onError(uploadError instanceof Error ? uploadError.message : "Could not upload");
      setBusy(false);
    }
  };

  return (
    <Flex
      align="center"
      gap="3"
      border="2px solid"
      borderColor="brand.contrast"
      borderRadius="md"
      px="3"
      py="2"
      bg="rgba(0, 0, 0, 0.06)"
    >
      <Box
        w="52px"
        h="52px"
        flexShrink={0}
        border="2px solid"
        borderColor="brand.contrast"
        borderRadius="md"
        overflow="hidden"
        bg="rgba(255, 255, 255, 0.5)"
        cursor="pointer"
        onClick={() => fileRef.current?.click()}
        title="Upload an image for this piece"
      >
        {piece.imagePath !== undefined ? (
          <img
            src={factionsApi.getPublicUrl(piece.imagePath, faction.updatedAt)}
            alt={piece.name ?? fallback}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <Flex w="100%" h="100%" align="center" justify="center" fontSize="1.4rem" color="brand.contrast">
            +
          </Flex>
        )}
      </Box>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) void uploadImage(file);
          event.target.value = "";
        }}
      />
      <VStack align="stretch" gap="0" flex="1">
        <Text color="brand.contrast" fontSize="0.8rem" opacity={0.7}>
          Tier {tier} — {fallback}
        </Text>
        <Input
          value={name}
          placeholder={fallback}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void saveName();
          }}
          size="sm"
          bg="white"
          color="brand.contrast"
          borderColor="brand.contrast"
          disabled={busy}
        />
      </VStack>
    </Flex>
  );
};

export const FactionsPage = () => {
  const [factions, setFactions] = useState<readonly Faction[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FactionType>("day");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const reload = useCallback(async () => {
    setFactions(await factionsApi.listOwn());
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user === null) {
        navigate("/signin");
        return;
      }
      reload().catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Could not load factions"),
      );
    })();
  }, [navigate, reload]);

  const createFaction = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (trimmed === "") return;
    setCreating(true);
    setError(null);
    try {
      const created = await factionsApi.create(trimmed, newType);
      setNewName("");
      await reload();
      setOpenId(created.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create faction");
    } finally {
      setCreating(false);
    }
  };

  const deleteFaction = async (faction: Faction): Promise<void> => {
    if (!window.confirm(`Delete faction "${faction.name}"?`)) return;
    setError(null);
    try {
      await factionsApi.delete(faction.id);
      await reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete faction");
    }
  };

  const replaceFaction = (updated: Faction): void => {
    setFactions((current) =>
      current.map((faction) => (faction.id === updated.id ? updated : faction)),
    );
  };

  return (
    <SplitLayout pageTitle="Factions">
      <Text color="brand.contrast">
        A faction is your own take on day or night: name each piece tier and
        give it your art. Pick a faction when you create or join a game.
      </Text>

      {error !== null && <ErrorBox>{error}</ErrorBox>}

      <form onSubmit={(event) => void createFaction(event)}>
        <HStack gap="2">
          <Input
            value={newName}
            placeholder="New faction name"
            onChange={(event) => setNewName(event.target.value)}
            bg="white"
            color="brand.contrast"
            borderColor="brand.contrast"
          />
          <HStack gap="0" borderRadius="md" overflow="hidden" border="2px solid" borderColor="brand.contrast" flexShrink={0}>
            {(["day", "night"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                borderRadius="0"
                bg={newType === value ? "brand.contrast" : "white"}
                color={newType === value ? "brand.solid" : "brand.contrast"}
                fontWeight="900"
                _hover={{ bg: newType === value ? "#3d3d3b" : "rgba(0, 0, 0, 0.1)" }}
                onClick={() => setNewType(value)}
              >
                {value}
              </Button>
            ))}
          </HStack>
          <SmallButton type="submit" loading={creating} flexShrink={0}>
            Create
          </SmallButton>
        </HStack>
      </form>

      <VStack align="stretch" gap="3">
        {factions.map((faction) => (
          <Box key={faction.id}>
            <Flex
              align="center"
              justify="space-between"
              border="2px solid"
              borderColor="brand.contrast"
              borderRadius="md"
              px="3"
              py="2"
              bg="rgba(0, 0, 0, 0.1)"
              cursor="pointer"
              onClick={() => setOpenId((current) => (current === faction.id ? null : faction.id))}
            >
              <HStack gap="2">
                <Text color="brand.contrast" fontWeight="900">
                  {faction.name}
                </Text>
                <Text color="brand.contrast" fontSize="0.8rem" opacity={0.7}>
                  {faction.type}
                </Text>
              </HStack>
              <SmallButton
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteFaction(faction);
                }}
              >
                Delete
              </SmallButton>
            </Flex>
            {openId === faction.id && (
              <VStack align="stretch" gap="2" mt="2" pl="2">
                {FACTION_TIERS.map((entry) => (
                  <TierRow
                    key={entry.kind}
                    faction={faction}
                    kind={entry.kind}
                    tier={entry.tier}
                    onSaved={replaceFaction}
                    onError={setError}
                  />
                ))}
              </VStack>
            )}
          </Box>
        ))}
        {factions.length === 0 && (
          <Text color="brand.contrast" opacity={0.7}>
            No factions yet — create one above.
          </Text>
        )}
      </VStack>
    </SplitLayout>
  );
};
