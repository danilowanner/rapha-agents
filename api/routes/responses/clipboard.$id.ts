import { createFileRoute } from "@tanstack/react-router";

import { getResponseClipboard } from "../../features/responses/state.ts";

export const Route = createFileRoute("/responses/clipboard/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        console.log("[RESPONSES/CLIPBOARD]", params.id);

        const clipboard = await getResponseClipboard(params.id);

        if (clipboard === null) return Response.json({ error: "Response not found" }, { status: 404 });
        return Response.json({ clipboard });
      },
    },
  },
});
