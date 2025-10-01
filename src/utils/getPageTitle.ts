import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getFirstToolMessage } from "./getFirstToolMessage.ts";

export function getPageTitle(result: CompatibilityCallToolResult): string {
  const raw = getFirstToolMessage(result);
  const titleMatch = raw.match(/- Page Title:\s*(.+)/);
  return titleMatch ? titleMatch[1].trim() : raw.trim().split("\n")[0];
}
