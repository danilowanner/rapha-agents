import type { Context } from "hono";
import { stream } from "hono/streaming";

import { getResponseStream } from "./state.ts";

/**
 * Streams markdown chunks as plain text for client-side consumption
 */
export const responseMarkdownHandler = (c: Context) => {
  console.log("[RESPONSES/MD]", c.req.param("id"));
  const responseStream = getResponseStream(c.req.param("id"));

  if (!responseStream) return c.text("Response not found", 404);

  c.header("Content-Type", "text/plain; charset=UTF-8");
  return stream(c, async (stream) => {
    try {
      for await (const chunk of responseStream) {
        await stream.write(chunk);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[RESPONSES/MD] Error streaming markdown:", errorMessage);
      await stream.write(`\n\n⚠️ Error streaming markdown: ${errorMessage}\n\n`);
    }
  });
};
