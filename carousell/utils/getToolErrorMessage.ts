import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function getToolErrorMessage(result: CompatibilityCallToolResult): string {
  if (!result.isError) return "";
  if (!Array.isArray(result.content)) return JSON.stringify(result.content);
  const text = result.content[0]?.text ?? JSON.stringify(result.content);
  return text.startsWith("Error: ") ? text.slice(7) : text;
}
