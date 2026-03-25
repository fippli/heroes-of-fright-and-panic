import { createSystem, defineConfig, defineTokens, defineSemanticTokens } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: defineTokens({
      colors: {
        brand: {
          50: { value: "#fff9e0" },
          100: { value: "#ffefb0" },
          200: { value: "#ffe580" },
          300: { value: "#ffdb50" },
          400: { value: "#ffd120" },
          500: { value: "#ffc800" },
          600: { value: "#cc9f00" },
          700: { value: "#997700" },
          800: { value: "#665000" },
          900: { value: "#332800" },
          950: { value: "#1a1400" },
        },
        day: {
          500: { value: "#ffc800" },
          600: { value: "#cc9f00" },
          700: { value: "#997700" },
        },
        night: {
          500: { value: "#b090ff" },
          600: { value: "#8868dd" },
          700: { value: "#6040bb" },
        },
      },
    }),
    semanticTokens: defineSemanticTokens({
      colors: {
        bg: {
          DEFAULT: { value: "#111111" },
          subtle: { value: "#1a1a1a" },
          muted: { value: "#222222" },
          surface: { value: "#0a0a0a" },
        },
        fg: {
          DEFAULT: { value: "#dddddd" },
          muted: { value: "#888888" },
          subtle: { value: "#aaaaaa" },
        },
        border: {
          DEFAULT: { value: "#333333" },
          subtle: { value: "#222222" },
        },
      },
    }),
  },
  globalCss: {
    body: {
      bg: "bg",
      color: "fg",
    },
  },
});

export const system = createSystem(config);
