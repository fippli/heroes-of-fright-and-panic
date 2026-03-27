import {
  createSystem,
  defineConfig,
  defineTokens,
  defineSemanticTokens,
} from "@chakra-ui/react";

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
          400: { value: "#b090ff" },
          500: { value: "#4a148c" },
          600: { value: "#6a1b9a" },
          700: { value: "#6040bb" },
        },
        danger: {
          500: { value: "#dc3545" },
          600: { value: "#c82333" },
        },
        success: {
          500: { value: "#28a745" },
        },
      },
      fonts: {
        heading: { value: "'Alagard', cursive" },
        body: { value: "'Alagard', cursive" },
      },
    }),
    semanticTokens: defineSemanticTokens({
      colors: {
        bg: {
          DEFAULT: { value: "#1d1d1b" },
          subtle: { value: "#1a1a1a" },
          muted: { value: "#222222" },
          surface: { value: "#0a0a0a" },
          panel: { value: "rgba(255, 255, 255, 0.05)" },
        },
        fg: {
          DEFAULT: { value: "#fafaf0" },
          muted: { value: "#888888" },
          subtle: { value: "#aaaaaa" },
        },
        border: {
          DEFAULT: { value: "#333333" },
          subtle: { value: "#222222" },
          brand: { value: "#ffc800" },
        },
        brand: {
          solid: { value: "{colors.brand.500}" },
          fg: { value: "{colors.brand.500}" },
          muted: { value: "{colors.brand.200}" },
          contrast: { value: "#1d1d1b" },
        },
      },
    }),
  },
  globalCss: {
    body: {
      bg: "bg",
      color: "fg",
      fontFamily: "body",
      lineHeight: 1.5,
      minHeight: "100vh",
    },
  },
});

export const system = createSystem(config);
