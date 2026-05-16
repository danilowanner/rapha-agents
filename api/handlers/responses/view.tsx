import type { Context } from "hono";
import { renderToString } from "react-dom/server";

import { createTestResponse } from "../../test/utils/createTestResponse.ts";
import { ClientApp } from "../../ui/ClientApp.tsx";
import { addResponse, createResponseId, hasResponse } from "./state.ts";

/**
 * Serves a static HTML view that fetches markdown from /responses/md/:id
 */
export const responseViewHandler = (c: Context) => {
  console.log("[RESPONSES/VIEW]", c.req.param("id"));
  let id = c.req.param("id");

  if (id === "test") {
    id = createResponseId();
    addResponse(id, createTestResponse(), { userId: "test" });
  }
  if (!hasResponse(id)) return c.text("Response not found", 404);

  const html = renderToString(
    <ClientApp payload={{ view: "markdown", title: "Rapha Studio API", markdownUrl: `/responses/md/${id}` }} />,
  );

  return c.html(`<!DOCTYPE html>${html}`);
};
