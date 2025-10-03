import { type ForegroundColorName } from "chalk";

import type { LogLevel } from "../types/LogLevel.ts";

export const colorByLevel: Record<LogLevel, ForegroundColorName> = {
  error: "red",
  info: "white",
  debug: "gray",
  notice: "blue",
  success: "green",
  stepUsage: "magenta",
  taskComplete: "cyan",
};

export const colorByComponent: Record<string, ForegroundColorName> = {
  CLI: "blueBright",
  AGENT: "blue",
  SCHEDULER: "yellow",
};
