import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { agentTools, executeAgentTool, type AnyTool } from "./tools.ts";

const mcpToolNames = {
  "Fetch-Youtube-Transcript": "fetch_youtube_transcript",
  "Web-Research": "web_research",
} as const satisfies { [K in keyof typeof agentTools]?: string };

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
  for (const [openApiName, mcpName] of Object.entries(mcpToolNames)) {
    const tool = agentTools[openApiName as keyof typeof agentTools] as AnyTool;
    registerSharedTool(server, mcpName, tool);
  }
  return server;
}

function registerSharedTool(server: McpServer, name: string, tool: AnyTool): void {
  server.registerTool(
    name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
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
