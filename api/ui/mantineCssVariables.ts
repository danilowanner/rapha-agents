import type { CSSVariablesResolver } from "@mantine/core";

const colorBody = "#f0f2f4";

/** Resolves Mantine CSS variables for the API UI. */
export const mantineCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--mantine-color-body": colorBody,
  },
  light: {
    "--mantine-color-body": colorBody,
  },
  dark: {
    "--mantine-color-body": colorBody,
  },
});
