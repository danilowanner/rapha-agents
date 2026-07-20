import { createFileRoute } from "@tanstack/react-router";

import { getErrorMessage } from "../../../libs/utils/getErrorMessage.ts";
import { authMiddleware } from "../../authHeaderMiddleware.ts";
import { executeTool } from "../../features/tools.ts";
import { corsHeaders, withCors } from "../../http.ts";

export const Route = createFileRoute("/tools/$name")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        POST: {
          middleware: [authMiddleware],
          handler: async ({ request, params }) => {
            const result = await executeTool(params.name, await request.json());

            if (result.type === "not-found") {
              return withCors(Response.json({ error: "Tool not found." }, { status: 404 }));
            }
            if (result.type === "missing-execute") {
              return withCors(Response.json({ error: "Tool missing execution function." }, { status: 500 }));
            }
            if (result.type === "error") return withCors(new Response(result.message, { status: 500 }));

            try {
              return withCors(Response.json(result.value));
            } catch (error) {
              console.error("[OPENAPI TOOL]", result.name, error);
              return withCors(new Response(getErrorMessage(error), { status: 500 }));
            }
          },
        },
        OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders }),
      }),
  },
});
