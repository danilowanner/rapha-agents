import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware } from "../authHeaderMiddleware.ts";
import { handleMcpRequest } from "../features/mcp.ts";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: { middleware: [authMiddleware], handler: ({ request }) => handleMcpRequest(request) },
        POST: { middleware: [authMiddleware], handler: ({ request }) => handleMcpRequest(request) },
        DELETE: { middleware: [authMiddleware], handler: ({ request }) => handleMcpRequest(request) },
      }),
  },
});
