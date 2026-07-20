import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware } from "../../authHeaderMiddleware.ts";
import { getToolsOpenApiDocument } from "../../features/tools.ts";
import { corsHeaders } from "../../http.ts";

export const Route = createFileRoute("/tools/openapi.json")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: {
          middleware: [authMiddleware],
          handler: () => Response.json(getToolsOpenApiDocument(), { headers: corsHeaders }),
        },
        OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      }),
  },
});
