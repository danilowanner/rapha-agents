import { createFileRoute } from "@tanstack/react-router";

import { getResponseResult } from "../../features/responses/state.ts";

export const Route = createFileRoute("/responses/result/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        console.log("[RESPONSES/RESULT]", params.id);
        const file = await getResponseResult(params.id);

        if (file === null) {
          return Response.json({ error: "Response not found" }, { status: 404 });
        }

        return Response.json(file);
      },
    },
  },
});
