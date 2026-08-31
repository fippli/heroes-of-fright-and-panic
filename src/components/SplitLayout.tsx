import type { ReactNode } from "react";
import { Box, Flex, Heading, VStack } from "@chakra-ui/react";

type SplitLayoutProps = {
  readonly pageTitle?: string;
  readonly children: ReactNode;
};

/**
 * Shared frame for every non-game page: the war scene on the left, a
 * parchment sheet with the page's content on the right.
 */
export const SplitLayout = ({ pageTitle, children }: SplitLayoutProps) => {
  return (
    <Flex minH="100vh" direction={{ base: "column", md: "row" }}>
      <Flex
        w={{ base: "100%", md: "50%" }}
        minH={{ base: "220px", md: "auto" }}
        direction="column"
        justify="flex-end"
        position="relative"
        backgroundImage="url(/img/hero.png)"
        backgroundSize="cover"
        backgroundPosition="center bottom"
        style={{ imageRendering: "pixelated" }}
      >
        <Box position="absolute" inset="0" bg="linear-gradient(180deg, rgba(43,33,23,0) 55%, rgba(43,33,23,0.55) 100%)" />
        <Heading
          as="h1"
          position="relative"
          fontSize={{ base: "3rem", md: "5rem" }}
          color="#f7eed8"
          fontWeight="900"
          lineHeight="1"
          p={{ base: "6", md: "10" }}
          textShadow="0 3px 0 #2b2117, 0 0 24px rgba(43,33,23,0.8)"
        >
          Dusk<br />and Dawn
        </Heading>
      </Flex>

      <Flex
        w={{ base: "100%", md: "50%" }}
        direction="column"
        align="center"
        justify="center"
        p={{ base: "6", md: "12" }}
        bg="bg"
        overflowY="auto"
        color="fg"
        borderLeft={{ md: "3px solid" }}
        borderColor={{ md: "border" }}
      >
        <VStack w="100%" maxW="420px" gap="4" align="stretch">
          {pageTitle !== undefined && (
            <Heading as="h2" fontSize="2.2rem" color="fg" mb="2" letterSpacing="1px">
              {pageTitle}
            </Heading>
          )}
          {children}
        </VStack>
      </Flex>
    </Flex>
  );
};
