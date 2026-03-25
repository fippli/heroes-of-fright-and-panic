import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { Flex, Box, Text, VStack } from "@chakra-ui/react";
import { OverworldSandbox } from "./OverworldSandbox";
import { BattleSandbox } from "./BattleSandbox";

const MODES = [
  { path: "battle", label: "Battle" },
  { path: "overworld", label: "Overworld" },
  { path: "castle", label: "Castle" },
  { path: "army", label: "Army" },
] as const;

const NotImplemented = ({ title }: { readonly title: string }) => (
  <Flex align="center" justify="center" h="100%" direction="column" gap="2">
    <Text fontSize="xl" color="fg.muted">{title}</Text>
    <Text fontSize="sm" color="fg.muted">Not implemented yet</Text>
  </Flex>
);

export const SandboxPage = () => {
  const location = useLocation();
  const activePath = location.pathname.split("/").at(-1) ?? "";

  return (
    <Flex direction="column" h="100vh" bg="bg" color="fg" fontFamily="mono" m="calc(-1 * var(--spacing-2xl))">
      <Flex gap="0" borderBottom="1px solid" borderColor="border" bg="bg.surface" flexShrink="0">
        {MODES.map((mode) => (
          <Box
            key={mode.path}
            as={Link}
            to={`/sandbox/${mode.path}`}
            px="5"
            py="2.5"
            fontSize="xs"
            fontFamily="mono"
            color={activePath === mode.path ? "brand.500" : "fg.muted"}
            textDecoration="none"
            borderBottom="2px solid"
            borderColor={activePath === mode.path ? "brand.500" : "transparent"}
            transition="colors"
            _hover={{ color: "fg.subtle", textDecoration: "none" }}
          >
            {mode.label}
          </Box>
        ))}
      </Flex>

      <Box flex="1" overflow="hidden">
        <Routes>
          <Route index element={<Navigate to="battle" replace />} />
          <Route path="battle" element={<BattleSandbox />} />
          <Route path="overworld" element={<OverworldSandbox />} />
          <Route path="castle" element={<NotImplemented title="Castle" />} />
          <Route path="army" element={<NotImplemented title="Army" />} />
        </Routes>
      </Box>
    </Flex>
  );
};
