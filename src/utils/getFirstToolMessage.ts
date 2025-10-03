import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getToolErrorMessage } from "./getToolErrorMessage.ts";

export function getFirstToolMessage(result: CompatibilityCallToolResult): string {
  if (result.isError) throw new Error(getToolErrorMessage(result));
  if (!Array.isArray(result.content)) throw new Error("Snapshot content is not an array");
  return result.content[0]?.text ?? "";
}
