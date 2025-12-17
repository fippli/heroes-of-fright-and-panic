import { createSystem, defaultConfig } from "@chakra-ui/react";

export const theme = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        primary: { value: "#8b5cf6" },
        secondary: { value: "#ec4899" },
      },
    },
  },
});
