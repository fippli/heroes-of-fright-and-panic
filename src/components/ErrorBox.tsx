import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

type ErrorBoxProps = {
  readonly children: ReactNode;
};

export const ErrorBox = ({ children }: ErrorBoxProps) => (
  <Box
    bg="rgba(220, 53, 69, 0.2)"
    color="#8b0000"
    border="2px solid"
    borderColor="danger.500"
    p="4"
    borderRadius="md"
    fontWeight="bold"
  >
    {children}
  </Box>
);
