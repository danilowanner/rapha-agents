import type { Client } from "@modelcontextprotocol/sdk/client";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../log.ts";
import { createBackoff } from "../../libs/utils/createBackoff.ts";
import { getToolErrorMessage } from "./getToolErrorMessage.ts";

const log = logger("CALL_TOOL");

const maxBackoffSeconds = 60;

export type CallToolOptions<TArgs = Record<string, unknown>> = {
  mcp: Promise<{ browserMcpClient: Client }>;
  name: string;
  arguments: TArgs;
  /** Max retry attempts (excluding the initial try). */
  retries?: number;
  /** Initial backoff minutes before first retry. */
  initialBackoffSeconds?: number;
  /** Growth factor for backoff. */
  factor?: number;
};

/**
 * Calls an MCP tool with retry + exponential backoff (minutes granularity).
 */
export async function callToolWithRetry(opts: CallToolOptions): Promise<CompatibilityCallToolResult> {
  const { mcp, name, arguments: args, retries = 2, initialBackoffSeconds = 5, factor = 3 } = opts;

  const backoff = createBackoff({ initial: initialBackoffSeconds, max: maxBackoffSeconds, factor });
  let attempt = 0;

  while (true) {
    try {
      const { browserMcpClient } = await mcp;
      const result = await browserMcpClient.callTool({ name, arguments: args });
      if (result.isError) {
        const message = getToolErrorMessage(result) || `Tool ${name} returned error`;
        if (attempt >= retries) throw new Error(message);
      } else {
        return result;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.notice(`Error calling tool ${name} (attempt ${attempt + 1}): ${errMsg}`);
      if (attempt >= retries) throw err;
    }
    const delaySeconds = backoff.current;
    backoff.increase();
    await new Promise((r) => setTimeout(r, delaySeconds * 1_000));
    attempt++;
  }
}
