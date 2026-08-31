import type { ReactNode } from "react";
import { Flex, Heading, VStack, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";

type SplitLayoutProps = {
  readonly pageTitle?: string;
  readonly children: ReactNode;
};

/**
 * Shared frame for every non-game page: the war scene fills the screen and
 * the page's content floats in a centred parchment column — the same layout
 * on a phone as on a desktop.
 */
export const SplitLayout = ({ pageTitle, children }: SplitLayoutProps) => {
  return (
    <Flex
      minH="100vh"
      align={{ base: "flex-start", md: "center" }}
      justify="center"
      p={{ base: "4", md: "8" }}
      backgroundImage="url(/img/hero.png)"
      backgroundSize="cover"
      backgroundPosition="center bottom"
      backgroundAttachment="fixed"
      style={{ imageRendering: "pixelated" }}
    >
      <VStack
        w="100%"
        maxW="440px"
        gap="4"
        align="stretch"
        bg="rgba(247, 238, 216, 0.95)"
        border="3px solid"
        borderColor="border"
        borderRadius="14px"
        boxShadow="0 18px 50px rgba(43, 33, 23, 0.45)"
        p={{ base: "6", md: "8" }}
        my={{ base: "8", md: "0" }}
      >
        <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }} alignSelf="center">
          <Link to="/">
            <Heading as="h1" fontSize="1.6rem" letterSpacing="2px" color="fg" textAlign="center">
              Dusk and Dawn
            </Heading>
          </Link>
        </ChakraLink>
        {pageTitle !== undefined && (
          <Heading as="h2" fontSize="2rem" color="fg" textAlign="center" letterSpacing="1px">
            {pageTitle}
          </Heading>
        )}
        {children}
      </VStack>
    </Flex>
  );
};
