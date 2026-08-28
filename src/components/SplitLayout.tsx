import type { ReactNode } from "react";
import { Flex, Box, Heading, VStack } from "@chakra-ui/react";

type SplitLayoutProps = {
  readonly pageTitle?: string;
  readonly children: ReactNode;
};

export const SplitLayout = ({ pageTitle, children }: SplitLayoutProps) => {
  return (
    <Flex minH="100vh">
      <Flex
        w="50%"
        direction="column"
        justify="center"
        p="20"
        bg="bg"
      >
        <Heading
          as="h1"
          fontSize="6rem"
          color="brand.fg"
          fontWeight="900"
          lineHeight="1.1"
          textShadow="0px 0px 25px #1d1d1b"
        >
          Dusk
          <br />
          and
          <br />
          Dawn
        </Heading>
      </Flex>

      <Flex
        w="50%"
        direction="column"
        align="center"
        justify="center"
        p="12"
        bg="brand.solid"
        overflowY="auto"
        color="brand.contrast"
      >
        <VStack w="100%" maxW="400px" gap="4" align="stretch">
          {pageTitle !== undefined && (
            <Heading
              as="h2"
              fontSize="2.2rem"
              color="brand.contrast"
              mb="4"
            >
              {pageTitle}
            </Heading>
          )}
          {children}
        </VStack>
      </Flex>
    </Flex>
  );
};
