import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ZodType } from "zod";
import { fetchWebsite } from "../libs/ai/fetchWebsiteTool.ts";
import { fetchYoutubeTranscript } from "../libs/ai/fetchYoutubeTranscriptTool.ts";
import { getErrorMessage } from "../libs/utils/getErrorMessage.ts";

const app = new Hono();

app.use("/*", cors());

const tools = {
  "Fetch-Website": fetchWebsite(async () => {}),
  "Fetch-Youtube-Transcript": fetchYoutubeTranscript(async () => {}),
};

/**
 * Returns OpenAPI 3.1.0 spec for all tools
 */
app.get("/openapi.json", (c: Context) => {
  const registry = new OpenAPIRegistry();

  Object.entries(tools).forEach(([name, tool]) => {
    registry.registerPath({
      method: "post",
      path: `/${name.toLocaleLowerCase()}`,
      operationId: name,
      summary: tool.description,
      request: {
        body: {
          content: {
            "application/json": {
              schema: tool.inputSchema as ZodType,
            },
          },
        },
      },
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: tool.outputSchema as ZodType,
            },
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
Object.entries(tools).forEach(([name, tool]) => {
  app.post(`/${name.toLocaleLowerCase()}`, async (c: Context) => {
    try {
      const params = await c.req.json();
      if (!tool.execute) return c.json({ error: "Tool missing execution function." }, 500);
      const result = await tool.execute(params, { messages: [], toolCallId: "" });
      return c.json(result);
    } catch (error) {
      return c.text(getErrorMessage(error), 500);
    }
  });
});

export const toolsApp = app;
