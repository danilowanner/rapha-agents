import { createFileRoute } from "@tanstack/react-router";

import { authMiddleware } from "../authHeaderMiddleware.ts";
import { getMemoryAsXml } from "../features/memory.ts";

export const Route = createFileRoute("/memory/$userId")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request, params }) => {
        const excludeChatId = new URL(request.url).searchParams.get("excludeChatId") ?? undefined;
        if (!params.userId) {
          return Response.json({ error: "userId is required" }, { status: 400 });
        }
        const xml = await getMemoryAsXml(params.userId, { excludeChatId });
        return Response.json({ xml });
      },
    },
  },
});
