import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function getFirstToolMessage(result: CompatibilityCallToolResult): string {
  if (result.isError) throw new Error(JSON.stringify(result.content));
  if (!Array.isArray(result.content)) throw new Error("Snapshot content is not an array");
  return result.content[0]?.text ?? "";
}
