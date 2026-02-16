import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import type { Tool } from "ai";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ZodType } from "zod";
import { fetchWebsite } from "../../libs/ai/fetchWebsiteTool.ts";
import { fetchYoutubeTranscript } from "../../libs/ai/fetchYoutubeTranscriptTool.ts";
import { googleSearch } from "../../libs/ai/googleSearchTool.ts";
import { getErrorMessage } from "../../libs/utils/getErrorMessage.ts";

const app = new Hono();

app.use("/*", cors());

const tools = {
  "Fetch-Website": fetchWebsite(null),
  "Fetch-Youtube-Transcript": fetchYoutubeTranscript(null),
  "Google-Search": googleSearch(null),
};

/** Tool with schemas typed as ZodType for OpenAPI compatibility. */
type AnyTool = Omit<Tool, "inputSchema" | "outputSchema"> & { inputSchema: ZodType; outputSchema: ZodType };

/** Iterates over tools with generic typing. */
const forEachTool = (fn: (name: string, tool: AnyTool) => void) =>
  Object.entries(tools).forEach(([name, tool]) => fn(name, tool as AnyTool));

/**
 * Returns OpenAPI 3.1.0 spec for all tools
 */
app.get("/openapi.json", (c: Context) => {
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
  const document = generator.generateDocument({
    openapi: "3.1.0",
    info: { title: "Rapha AI Tools", version: "1.0.0" },
  });

  return c.json(document);
});

/**
 * Generate endpoints for each tool
 */
forEachTool((name, tool) => {
  app.post(`/${name.toLocaleLowerCase()}`, async (c: Context) => {
    try {
      const rawParams = await c.req.json();
      const params = tool.inputSchema.parse(rawParams);
      if (!tool.execute) return c.json({ error: "Tool missing execution function." }, 500);
      const result = await tool.execute(params, { messages: [], toolCallId: "" });
      return c.json(result);
    } catch (error) {
      return c.text(getErrorMessage(error), 500);
    }
  });
});

export const toolsApp = app;
