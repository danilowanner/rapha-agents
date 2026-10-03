import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { antikenmuseumMaintenanceTool } from "./antikenmuseumMaintenance.ts";
import { getHoldingsTool } from "./ibkr/getHoldings.ts";
import { agentTools, executeAgentTool, type AnyTool } from "./tools.ts";

const mcpToolNames = {
  "Fetch-Youtube-Transcript": "fetch_youtube_transcript",
  "Web-Research": "web_research",
} as const satisfies { [K in keyof typeof agentTools]?: string };

type McpToolEntry = { tool: AnyTool; annotations?: ToolAnnotations };

const mcpTools: Record<string, McpToolEntry> = {
  ...Object.fromEntries(
    Object.entries(mcpToolNames).map(([openApiName, name]) => [
      name,
      { tool: agentTools[openApiName as keyof typeof agentTools] as AnyTool },
    ]),
  ),
  ibkr_get_holdings: {
    tool: getHoldingsTool as AnyTool,
    annotations: { readOnlyHint: true },
  },
  antikenmuseum_maintenance: {
    tool: antikenmuseumMaintenanceTool as AnyTool,
    annotations: { readOnlyHint: true },
  },
};

/**
 * Handles one stateless MCP Streamable HTTP request.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  try {
    const response = await transport.handleRequest(request);
    if (request.method !== "GET") await closeMcp(server, transport);
    return response;
  } catch (error) {
    await closeMcp(server, transport);
    throw error;
  }
}

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "rapha-api", version: "1.0.0" });
  for (const [name, entry] of Object.entries(mcpTools)) {
    registerTool(server, name, entry.tool, entry.annotations);
  }
  return server;
}

function registerTool(server: McpServer, name: string, tool: AnyTool, annotations?: ToolAnnotations): void {
  server.registerTool(
    name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations,
    },
    async (args: unknown) => {
      const value = await executeAgentTool(tool, args);
      return {
        content: [{ type: "text", text: JSON.stringify(value) }],
        structuredContent: asStructuredContent(value),
      };
    },
  );
}

function asStructuredContent(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Tool result must be an object.");
  }
  return value as Record<string, unknown>;
}

async function closeMcp(server: McpServer, transport: WebStandardStreamableHTTPServerTransport): Promise<void> {
  await transport.close();
  await server.close();
}
