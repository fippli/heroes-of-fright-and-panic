import { type DragEvent, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useAdmin } from "../../lib/use-admin";
import { themesApi, type ThemeAsset } from "../../lib/theme-api";
import { ErrorBox } from "../../components/ErrorBox";
import {
  type Faction,
  FACTIONS,
  getSlotsForFaction,
} from "../../images/asset-keys";

const isFaction = (value: string): value is Faction =>
  FACTIONS.some((faction) => faction.id === value);

export const ThemeEditorPage = () => {
  const { themeId, factionId } = useParams();
  const { isAdmin, isLoading, user } = useAdmin();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<readonly ThemeAsset[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const faction: Faction | undefined =
    factionId !== undefined && isFaction(factionId) ? factionId : undefined;

  useEffect(() => {
    if (!isLoading && user === null) {
      navigate("/signin");
    }
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!isLoading && isAdmin && themeId !== undefined) {
      themesApi.getAssets(themeId).then(setAssets).catch(console.error);
    }
  }, [isLoading, isAdmin, themeId]);

  const findAsset = (
    category: string,
    assetKey: string,
  ): ThemeAsset | undefined =>
    assets.find(
      (asset) => asset.category === category && asset.assetKey === assetKey,
    );

  const uploadFile = async (category: string, assetKey: string, file: File) => {
    if (themeId === undefined) return;

    const slotKey = `${category}/${assetKey}`;
    setUploading(slotKey);
    setError(null);

    try {
      const newAsset = await themesApi.uploadAsset(
        themeId,
        category,
        assetKey,
        file,
      );
      setAssets((current) =>
        current
          .filter(
            (asset) =>
              !(asset.category === category && asset.assetKey === assetKey),
          )
          .concat(newAsset),
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Upload failed";
      setError(message);
    } finally {
      setUploading(null);
    }
  };

  const handleDrop = (
    category: string,
    assetKey: string,
    event: DragEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    setDragOver(null);

    const file = event.dataTransfer.files.item(0);
    if (file === null) return;
    if (!file.type.startsWith("image/")) return;

    uploadFile(category, assetKey, file);
  };

  const handleDeleteAsset = async (assetId: string) => {
    setError(null);
    try {
      await themesApi.deleteAsset(assetId);
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Delete failed";
      setError(message);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!isAdmin || themeId === undefined) {
    return (
      <Box p="8">
        <ErrorBox>
          {themeId === undefined ? "No theme ID provided." : "No admin access."}
        </ErrorBox>
        <ChakraLink
          asChild
          mt="4"
          display="inline-block"
          textDecoration="none"
          _hover={{ textDecoration: "none" }}
        >
          <Link to="/admin/themes">
            <Button
              variant="outline"
              borderColor="fg"
              color="fg"
              _hover={{ bg: "bg.muted" }}
            >
              Back
            </Button>
          </Link>
        </ChakraLink>
      </Box>
    );
  }

  const pieceSlots =
    faction !== undefined ? getSlotsForFaction(faction, "piece") : [];
  const buildingSlots =
    faction !== undefined ? getSlotsForFaction(faction, "building") : [];
  const landscapeSlots =
    faction === "landscape" ? getSlotsForFaction("landscape", "landscape") : [];
  const itemSlots = faction === "items" ? getSlotsForFaction("items", "piece") : [];

  const renderGrid = (
    slots: readonly {
      readonly category: string;
      readonly key: string;
      readonly label: string;
    }[],
  ) => (
    <Flex wrap="wrap" gap="3">
      {slots.map((slot) => {
        const existingAsset = findAsset(slot.category, slot.key);
        const slotKey = `${slot.category}/${slot.key}`;
        const isUploading = uploading === slotKey;
        const isDraggedOver = dragOver === slotKey;

        return (
          <Box key={slotKey} w="120px">
            {existingAsset !== undefined ? (
              <Box w="120px" h="120px" position="relative">
                <img
                  src={themesApi.getPublicUrl(existingAsset.storagePath)}
                  alt={slot.label}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
                <Button
                  position="absolute"
                  top="2px"
                  right="2px"
                  size="xs"
                  bg="danger.500"
                  color="white"
                  _hover={{ bg: "danger.600" }}
                  onClick={() => handleDeleteAsset(existingAsset.id)}
                >
                  x
                </Button>
              </Box>
            ) : (
              <Flex
                as="label"
                align="center"
                justify="center"
                w="120px"
                h="120px"
                border={isDraggedOver ? "2px solid" : "2px dashed"}
                borderColor="brand.contrast"
                cursor="pointer"
                fontSize="1.5rem"
                opacity={isUploading ? 0.5 : 1}
                color="brand.contrast"
                onDrop={(event: DragEvent<HTMLElement>) =>
                  handleDrop(slot.category, slot.key, event)
                }
                onDragOver={(event: DragEvent<HTMLElement>) => {
                  event.preventDefault();
                  setDragOver(slotKey);
                }}
                onDragLeave={() => setDragOver(null)}
              >
                {isUploading ? "..." : "+"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.item(0);
                    if (file !== undefined && file !== null) {
                      uploadFile(slot.category, slot.key, file);
                    }
                  }}
                  disabled={isUploading}
                />
              </Flex>
            )}
            <Text fontSize="xs" textAlign="center" color="brand.contrast">
              {slot.label}
            </Text>
          </Box>
        );
      })}
    </Flex>
  );

  return (
    <Flex minH="100vh">
      <VStack
        w="250px"
        p="12"
        bg="bg"
        align="stretch"
        gap="2"
        justify="flex-start"
      >
        {FACTIONS.map(({ id, label }) => (
          <ChakraLink
            key={id}
            asChild
            fontWeight={faction === id ? "900" : "normal"}
            opacity={faction === id ? 1 : 0.6}
            color="brand.fg"
            textDecoration="none"
            _hover={{ textDecoration: "none", opacity: 1 }}
          >
            <Link to={`/admin/themes/${themeId}/factions/${id}`}>{label}</Link>
          </ChakraLink>
        ))}
        <Box mt="auto">
          <ChakraLink
            asChild
            textDecoration="none"
            _hover={{ textDecoration: "none" }}
          >
            <Link to="/admin/themes">
              <Button
                variant="outline"
                borderColor="fg"
                color="fg"
                _hover={{ bg: "bg.muted" }}
              >
                Back
              </Button>
            </Link>
          </ChakraLink>
        </Box>
      </VStack>

      <Flex
        flex="1"
        direction="column"
        p="12"
        bg="brand.solid"
        color="brand.contrast"
        gap="6"
        overflowY="auto"
      >
        {error !== null && <ErrorBox>{error}</ErrorBox>}

        {faction === undefined && (
          <Text color="brand.contrast">Select a faction to edit assets.</Text>
        )}

        {faction === "items" && (
          <>
            <Heading as="h3" fontSize="1.25rem" color="brand.contrast">
              Equipment & steeds
            </Heading>
            <Text fontSize="sm" color="brand.contrast" opacity={0.8}>
              Drawn on top of (equipment) or underneath (steeds) any piece that carries them, for both factions.
            </Text>
            {renderGrid(itemSlots)}
          </>
        )}

        {faction !== undefined && faction !== "landscape" && faction !== "items" && (
          <>
            <Heading as="h3" fontSize="1.25rem" color="brand.contrast">
              Pieces
            </Heading>
            {renderGrid(pieceSlots)}
            <Heading as="h3" fontSize="1.25rem" color="brand.contrast">
              Buildings
            </Heading>
            {renderGrid(buildingSlots)}
          </>
        )}

        {faction === "landscape" && (
          <>
            <Heading as="h3" fontSize="1.25rem" color="brand.contrast">
              Landscape
            </Heading>
            {renderGrid(landscapeSlots)}
          </>
        )}
      </Flex>
    </Flex>
  );
};
