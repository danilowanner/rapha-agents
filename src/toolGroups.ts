import { type ToolName } from "./tools.ts";

// Core navigation & page discovery
export const browserBasics: ToolName[] = ["browserNavigate", "browserSnapshot", "browserWait"];

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
