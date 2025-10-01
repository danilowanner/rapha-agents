import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function getFirstToolMessage(result: CompatibilityCallToolResult): string {
  if (result.isError) throw new Error(getErrorMessage(result));
  if (!Array.isArray(result.content)) throw new Error("Snapshot content is not an array");
  return result.content[0]?.text ?? "";
}

function getErrorMessage(result: CompatibilityCallToolResult): string {
  if (!result.isError) return "";
  if (!Array.isArray(result.content)) return JSON.stringify(result.content);
  const text = result.content[0]?.text ?? JSON.stringify(result.content);
  return text.startsWith("Error: ") ? text.slice(7) : text;
}
