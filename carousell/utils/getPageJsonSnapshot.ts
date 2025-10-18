import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import yaml from "js-yaml";

import type { SnapshotNode } from "../types/SnapshotNode.ts";
import { getFirstToolMessage } from "./getFirstToolMessage.ts";

export function getPageJsonSnapshot(result: CompatibilityCallToolResult): Array<SnapshotNode> {
  const raw = getFirstToolMessage(result);
  const yamlBlockMatch = raw.match(/```(?:yaml)?\s*([\s\S]*?)```/i);
  const toParse = yamlBlockMatch ? yamlBlockMatch[1].trim() : raw.trim();
  const parsed = yaml.load(toParse);
  const firstDocument = Array.isArray(parsed) ? parsed[0] : parsed;
  const content = firstDocument && typeof firstDocument === "object" && Object.values(firstDocument)[0];
  if (!content) throw new Error("No YAML documents found in snapshot");
  return content;
}
