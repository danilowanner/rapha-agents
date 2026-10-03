import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import type { Tool } from "ai";
import type { ZodType } from "zod";

import { fetchWebsite } from "../../libs/ai/fetchWebsiteTool.ts";
import { fetchYoutubeTranscript } from "../../libs/ai/fetchYoutubeTranscriptTool.ts";
import { webResearch } from "../../libs/ai/webResearchTool.ts";
import { getErrorMessage } from "../../libs/utils/getErrorMessage.ts";

export const agentTools = {
  "Fetch-Website": fetchWebsite(null),
  "Fetch-Youtube-Transcript": fetchYoutubeTranscript(null),
  "Web-Research": webResearch(null),
};

export type AnyTool = Omit<Tool, "inputSchema" | "outputSchema"> & { inputSchema: ZodType; outputSchema: ZodType };

export type ToolExecutionResult =
  | { type: "success"; name: string; value: unknown }
  | { type: "not-found" }
  | { type: "missing-execute" }
  | { type: "error"; message: string };

/**
 * Returns OpenAPI 3.1.0 spec for all tools.
 */
export function getToolsOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  forEachTool((name, tool) => {
    registry.registerPath({
      method: "post",
      path: `/${name.toLocaleLowerCase()}`,
      operationId: name,
      summary: tool.description,
      request: {
        body: {
          content: {
            "application/json": { schema: tool.inputSchema },
          },
        },
      },
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": { schema: tool.outputSchema },
          },
        },
      },
    });
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: { title: "Rapha AI Tools", version: "1.0.0" },
  });
}

/**
 * Executes a tool by its lowercase route name.
 */
export async function executeTool(toolRouteName: string, rawParams: unknown): Promise<ToolExecutionResult> {
  const entry = Object.entries(agentTools).find(
    ([name]) => name.toLocaleLowerCase() === toolRouteName.toLocaleLowerCase(),
  );
  if (!entry) return { type: "not-found" };

  const [name, rawTool] = entry;
  const tool = rawTool as AnyTool;

  if (!tool.execute) return { type: "missing-execute" };

  try {
    console.log("[OPENAPI TOOL] request", name, JSON.stringify(rawParams));
    const value = await executeAgentTool(tool, rawParams);
    return { type: "success", name, value };
  } catch (error) {
    console.error("[OPENAPI TOOL]", name, error);
    return { type: "error", message: getErrorMessage(error) };
  }
}

/**
 * Runs one agent tool. OpenAPI and MCP both call this.
 */
export async function executeAgentTool(tool: AnyTool, rawParams: unknown): Promise<unknown> {
  const params = tool.inputSchema.parse(rawParams);
  if (!tool.execute) throw new Error("Tool missing execution function.");
  return tool.execute(params, { messages: [], toolCallId: "" });
}

const forEachTool = (fn: (name: string, tool: AnyTool) => void): void => {
  Object.entries(agentTools).forEach(([name, tool]) => fn(name, tool as AnyTool));
};
