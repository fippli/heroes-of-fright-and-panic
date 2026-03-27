import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

type SuccessBoxProps = {
  readonly children: ReactNode;
};

export const SuccessBox = ({ children }: SuccessBoxProps) => (
  <Box
    bg="rgba(40, 167, 69, 0.2)"
    color="#006400"
    border="2px solid"
    borderColor="success.500"
    p="4"
    borderRadius="md"
    fontWeight="bold"
  >
    {children}
  </Box>
);
