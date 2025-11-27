import type { Context } from "hono";
import { renderToString } from "react-dom/server";

import { Document } from "../ui/Document.tsx";
import { ResponseContainer } from "../ui/ResponseContainer.tsx";
import { hasResponse } from "./state.ts";

/**
 * Serves a static HTML view that fetches markdown from /responses/md/:id
 */
export const responseViewHandler = (c: Context) => {
  console.log("[RESPONSES/VIEW]", c.req.param("id"));
  const id = c.req.param("id");

  if (!hasResponse(id)) return c.text("Response not found", 404);

  const html = renderToString(
    <Document title="Rapha Studio API">
      <ResponseContainer id={id} />
    </Document>
  );

  return c.html(`<!DOCTYPE html>${html}`);
};
