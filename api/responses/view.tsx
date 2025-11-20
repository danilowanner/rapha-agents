import type { Context } from "hono";
import { stream } from "hono/streaming";
import { renderToString } from "react-dom/server";

import { Layout } from "../ui/Layout.tsx";
import { contentPlaceholder, ResponseContainer } from "../ui/ResponseContainer.tsx";
import { getResponse } from "./state.ts";

/**
 * Serves a streaming HTML view with React SSR and progressive markdown rendering
 */
export const responseViewHandler = (c: Context) => {
  console.log("[RESPONSES/VIEW]", c.req.param("id"));
  const response = getResponse(c.req.param("id"));

  if (!response) return c.text("Response not found", 404);

  c.header("Content-Type", "text/html; charset=UTF-8");
  return stream(c, async (stream) => {
    console.log("[STREAM]");
    const layoutHtml = renderToString(
      <Layout title="Rapha Studio API">
        <ResponseContainer />
      </Layout>
    );

    const [beforeContent, afterContent] = layoutHtml.split(contentPlaceholder);

    await stream.write(`<!DOCTYPE html>${beforeContent}`);

    try {
      for await (const chunk of response.viewStream) {
        const escapedChunk = JSON.stringify(chunk);
        await stream.write(`<script>window.Rapha.pushChunk(${escapedChunk});</script>`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await stream.write(`<p><strong>Error streaming markdown:</strong> ${errorMessage}</p>`);
    }

    await stream.write(`</div>${afterContent}`);
  });
};
