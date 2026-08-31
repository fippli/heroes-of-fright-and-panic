import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Box, Button, Flex, Heading, Link as ChakraLink, Text } from "@chakra-ui/react";
import { supabase } from "../../lib/supabase";

/** Full-viewport hero: the Day and Night armies meeting on the paper map */
export const LandingPage = () => {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setSignedIn(data.user !== null))
      .catch(() => setSignedIn(false));
  }, []);

  return (
    <Flex
      minH="100vh"
      direction="column"
      align="center"
      justify="flex-start"
      position="relative"
      backgroundImage="url(/img/hero.png)"
      backgroundSize="cover"
      backgroundPosition="center"
      style={{ imageRendering: "pixelated" }}
    >
      <Flex position="relative" direction="column" align="center" gap="4" pt={{ base: "12", md: "16" }} px="6" textAlign="center">
        <Heading
          as="h1"
          fontSize={{ base: "3.4rem", md: "6rem" }}
          lineHeight="0.95"
          color="#2b2117"
          textShadow="0 3px 0 rgba(247, 238, 216, 0.9)"
        >
          Dusk and Dawn
        </Heading>
        <Text fontSize={{ base: "1.1rem", md: "1.4rem" }} color="#54462f" maxW="34rem">
          Two alliances, one island, twelve hours apiece. Build by day. Endure the night.
        </Text>
        <Flex gap="4" mt="2" wrap="wrap" justify="center">
          <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
            <Link to={signedIn === true ? "/games" : "/signin"}>
              <Button
                size="xl"
                px="10"
                bg="day.500"
                color="#2b2117"
                fontWeight="900"
                fontSize="1.2rem"
                boxShadow="0 4px 0 #6d541b"
                _hover={{ transform: "translateY(-2px)" }}
              >
                {signedIn === true ? "Enter your games" : "Sign in"}
              </Button>
            </Link>
          </ChakraLink>
          <ChakraLink asChild textDecoration="none" _hover={{ textDecoration: "none" }}>
            <Link to="/signup">
              <Button
                size="xl"
                px="10"
                bg="night.500"
                color="#f7eed8"
                fontWeight="900"
                fontSize="1.2rem"
                boxShadow="0 4px 0 #382e4c"
                _hover={{ transform: "translateY(-2px)" }}
              >
                Join the war
              </Button>
            </Link>
          </ChakraLink>
        </Flex>
        <ChakraLink asChild color="#6b5b44" fontSize="0.95rem" mt="1">
          <Link to="/docs/game-specification">How the war is fought →</Link>
        </ChakraLink>
      </Flex>
    </Flex>
  );
};
