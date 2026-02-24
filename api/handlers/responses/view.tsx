import type { Context } from "hono";
import { renderToString } from "react-dom/server";

import { createTestResponse } from "../../test/utils/createTestResponse.ts";
import { Document } from "../../ui/Document.tsx";
import { DocumentContainer } from "../../ui/DocumentContainer.tsx";
import { addResponse, hasResponse } from "./state.ts";

/**
 * Serves a static HTML view that fetches markdown from /responses/md/:id
 */
export const responseViewHandler = (c: Context) => {
  console.log("[RESPONSES/VIEW]", c.req.param("id"));
  let id = c.req.param("id");

  if (id === "test") id = addResponse(createTestResponse());
  if (!hasResponse(id)) return c.text("Response not found", 404);

  const html = renderToString(
    <Document title="Rapha Studio API">
      <DocumentContainer dataDocument={{ markdownUrl: `/responses/md/${id}` }} />
    </Document>
  );

  return c.html(`<!DOCTYPE html>${html}`);
};
