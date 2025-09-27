import { type ToolName } from "./tools.ts";

// Core navigation & page discovery
export const browserBasics: ToolName[] = ["browserNavigate", "browserGetPageText", "browserSnapshot", "browserWait"];

// Element interaction primitives
export const browserInteractions: ToolName[] = [
  "browserClick",
  "browserHover",
  "browserType",
  "browserPressKey",
  "browserSelectOption",
];

// Retrieval / inspection utilities
export const browserInspection: ToolName[] = ["browserGetConsoleLogs", "browserScreenshot"];

// Data / persistence operations
export const dataOps: ToolName[] = ["dbAddListings", "dbAddTasks"];

export const allTools: ToolName[] = Array.from(
  new Set([...browserBasics, ...browserInteractions, ...browserInspection, ...dataOps])
);
