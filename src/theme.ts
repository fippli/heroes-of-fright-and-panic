import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineTokens,
  defineSemanticTokens,
} from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: defineTokens({
      colors: {
        brand: {
          50: { value: "#f7eed8" },
          100: { value: "#efe3c6" },
          200: { value: "#e4d3a8" },
          300: { value: "#d5bd85" },
          400: { value: "#c9a24b" },
          500: { value: "#a8842b" },
          600: { value: "#8a6b22" },
          700: { value: "#6d541b" },
          800: { value: "#4f3d14" },
          900: { value: "#33270d" },
          950: { value: "#241a10" },
        },
        day: {
          500: { value: "#c9a24b" },
          600: { value: "#a8842b" },
          700: { value: "#8a6b22" },
        },
        night: {
          400: { value: "#b7a6d9" },
          500: { value: "#5b4a7a" },
          600: { value: "#4a3c64" },
          700: { value: "#6f5b94" },
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
          DEFAULT: { value: "#efe3c6" },
          subtle: { value: "#f7eed8" },
          muted: { value: "#e4d3a8" },
          surface: { value: "#f7eed8" },
          panel: { value: "rgba(43, 33, 23, 0.05)" },
        },
        fg: {
          DEFAULT: { value: "#2b2117" },
          muted: { value: "#6b5b44" },
          subtle: { value: "#54462f" },
        },
        border: {
          DEFAULT: { value: "#cdb994" },
          subtle: { value: "#e4d3a8" },
          brand: { value: "#a8842b" },
        },
        brand: {
          // The parchment sheet the site is written on: ink on paper,
          // gold for Day actions, violet for Night
          solid: { value: "{colors.brand.100}" },
          fg: { value: "#2b2117" },
          muted: { value: "{colors.brand.300}" },
          contrast: { value: "#2b2117" },
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

export const system = createSystem(defaultConfig, config);
