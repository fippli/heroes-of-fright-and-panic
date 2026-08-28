import { Text, Link as ChakraLink } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { SplitLayout } from "../../components/SplitLayout";

export const AboutPage = () => {
  return (
    <SplitLayout pageTitle="About">
      <Text fontSize="lg" color="brand.contrast">
        Dusk and Dawn is a turn-based strategy game where two
        players command rival alliances — Day and Night — on a shared
        battlefield. Build your forces, outmaneuver your opponent, and claim
        victory.
      </Text>

      <ChakraLink asChild color="brand.contrast" textDecoration="underline" _hover={{ color: "#3d3d3b" }}>
        <Link to="/games">Back to menu</Link>
      </ChakraLink>
    </SplitLayout>
  );
};
